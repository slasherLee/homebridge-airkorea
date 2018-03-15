'use strict';

const firmware = require('./package.json').version;
const request = require('request');

var Service;
var Characteristic;

function AirKoreaAccessory(log, config) {
  this.log = log;
  this.name = config.name;
  this.key = config.api_key;
  this.sensor = config.sensor || 'air_quality';
  this.station = config.station;
  this.polling = config.polling || false;
  this.serial = 'station';

  if (!this.key) {
    throw new Error('API key not specified');
  }
  if (!this.sensor) {
    this.log.error('Unsupported sensor specified, defaulting to air quality');
    this.sensor = 'air_quality';
  }
  if (!this.station) {
    throw new Error('station not specified');
  }
  if (!([true, false].indexOf(this.polling) > -1)) {
    this.log.error('Unsupported option specified for polling, defaulting to false');
    this.polling = false;
  }


  if (this.polling) {
    var that = this;
    this.interval = 60 * 60000;
    setTimeout(function () {
      that.servicePolling();
    }, this.interval);
  }

  this.log.debug('Polling is %s', (this.polling) ? 'enabled' : 'disabled');

  this.conditions = {};
}

AirKoreaAccessory.prototype = {

  servicePolling: function () {
    this.log.debug('Polling');
    this.getData(function (conditions) {
      var that = this;
      switch (that.sensor) {
        case 'air_quality':
        default:
          that.sensorService.setCharacteristic(
            Characteristic.AirQuality,
            conditions.air_quality
          );
          break;
      }
      setTimeout(function () {
        that.servicePolling();
      }, that.interval);
    }.bind(this));
  },

  getAirQuality: function (callback) {
    this.getData(function (conditions) {
      callback(null, conditions.air_quality);
    });
  },


  getData: function (callback) {
    var that = this;
    var url = 'http://openapi.airkorea.or.kr/openapi/services/rest/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?stationName=' + encodeURIComponent(that.station) + 
              '&dataTerm=month&pageNo=1&numOfRows=1&ServiceKey=' + that.key + '&_returnType=json'

    request({
      url: url,
      json: true
    }, function (error, response, data) {
      if (!error) {
        switch (response.statusCode) {
          case 200:
                that.conditions.aqi = parseFloat(data.list[0].khaiValue);
                that.conditions.air_quality = that.convertGrade(data.list[0].khaiGrade);

                that.log.debug('Time is: %s', data.list[0].dataTime);
                that.log.debug('Station is: %s', data.parm.stationName);

                switch (that.sensor) {
                  case 'air_quality':
		  default:
                    that.log.debug('Current aqi value is: %s', that.conditions.aqi);
                    that.log.debug('Current aqi grade is: %s', that.conditions.air_quality);
                    if (data.list[0].pm10Value) {
               	      that.conditions.pm10 = parseFloat(data.list[0].pm10Value);
                      that.log.debug('Current PM10 density is: %s', that.conditions.pm10);
                      that.sensorService
                        .getCharacteristic(Characteristic.PM10Density)
                        .setValue(that.conditions.pm10); 
                    }
                    if (data.list[0].pm25Value) {
               	      that.conditions.pm25 = parseFloat(data.list[0].pm25Value);
                      that.log.debug('Current PM25 density is: %s', that.conditions.pm25);
                      that.sensorService
                        .getCharacteristic(Characteristic.PM2_5Density)
                        .setValue(that.conditions.pm25); 
                    }
                    if (data.list[0].o3Value) {
               	      that.conditions.o3 = parseFloat(data.list[0].o3Value) * 1000;
                      that.log.debug('Current Ozon density is: %s', that.conditions.o3);
                      that.sensorService
                        .getCharacteristic(Characteristic.OzoneDensity)
                        .setValue(that.conditions.o3); 
                    }
                    break;
                }
                that.sensorService
                  .getCharacteristic(Characteristic.StatusActive)
                  .setValue(true);
            break;
          default:
            that.log.error('Response: %s', response.statusCode);
            that.sensorService
              .getCharacteristic(Characteristic.StatusActive)
              .setValue(false);
            break;
        }
      } else {
        that.log.error('Unknown error: %s', error);
        that.sensorService
          .getCharacteristic(Characteristic.StatusActive)
          .setValue(false);
      }
      callback(that.conditions);
    });
  },

  convertGrade: function (grade) {
    var characteristic;
    if (!grade) {
      characteristic = Characteristic.AirQuality.UNKNOWN;
    } else if (grade == 4) {
      characteristic = Characteristic.AirQuality.POOR;
    } else if (grade == 3) {
      characteristic = Characteristic.AirQuality.INFERIOR;
    } else if (grade == 2) {
      characteristic = Characteristic.AirQuality.FAIR;
    } else if (grade == 1) {
      characteristic = Characteristic.AirQuality.GOOD;
    } else {
      characteristic = Characteristic.AirQuality.UNKNOWN;
    }
    return characteristic;
  },

  identify: function (callback) {
    this.log.debug('Identified');
    callback();
  },

  getServices: function () {
    var services = [];

    this.accessoryInformationService = new Service.AccessoryInformation();

    this.accessoryInformationService
      .setCharacteristic(Characteristic.FirmwareRevision, firmware)
      .setCharacteristic(Characteristic.Manufacturer, 'AirKorea')
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.SerialNumber, this.serial);

    this.accessoryInformationService
      .setCharacteristic(Characteristic.Identify)
      .on('set', this.identify.bind(this));

    switch (this.sensor) {
      case 'air_quality':
      default:
        this.model = 'Air Quality Sensor';
        this.sensorService = new Service.AirQualitySensor();
        this.sensorService
	  .getCharacteristic(Characteristic.AirQuality)
	  .on('get', this.getAirQuality.bind(this));
        break;
    }

    this.accessoryInformationService
      .setCharacteristic(Characteristic.Model, this.model);

    this.sensorService
      .setCharacteristic(Characteristic.Name, this.name);

    this.sensorService
      .addCharacteristic(Characteristic.StatusActive);

    services.push(
      this.accessoryInformationService,
      this.sensorService
    );

    return services;
  }
};

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-airkorea', 'AirKorea', AirKoreaAccessory);
};
