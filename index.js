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
    this.interval = config.interval * 60 * 1000;
    if(!config.creteria)
        this.creteria = 'khai';
    else
        this.creteria = config.creteria;

    if (!this.key) {
        throw new Error('API key not specified');
    }
    if (!this.sensor) {
        this.log.error('Unsupported sensor specified, defaulting to air quality');
        this.sensor = 'air_quality';
    }
    if (!this.station) {
        throw new Error('station is not specified');
    }
    if (!([true, false].indexOf(this.polling) > -1)) {
        this.log.error('Unsupported option specified for polling, defaulting to false');
        this.polling = false;
    }
    if (!this.interval) {
        this.log.error('interval is not specified, defaulting to 60');
        this.interval = 60 * 60 * 1000;
    }

    if (this.polling) {
        var that = this;
        setTimeout(function () {
            that.servicePolling();
        }, that.interval);
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
        var url = 'http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?stationName=' +                   encodeURIComponent(that.station) + '&dataTerm=month&pageNo=1&numOfRows=1&ServiceKey=' + that.key + '&_returnType=json'
        var khai_grade = Characteristic.AirQuality.UNKNOWN;
        var pm25_grade = Characteristic.AirQuality.UNKNOWN;
        var pm10_grade = Characteristic.AirQuality.UNKNOWN;

        request({
            url: url,
            json: true
        }, function (error, response, data) {
            if (!error) {
                switch (response.statusCode) {
                    case 200:

                        that.log.debug('Time is: %s', data.list[0].dataTime);
                        that.log.debug('Station is: %s', data.parm.stationName);

                        switch (that.sensor) {
                            case 'air_quality':
                            default:
                                if( data.list[0].khaiValue != "-" ) {
                                    khai_grade = that.convertKhaiGrade(data.list[0].khaiValue);
                                    that.conditions.aqi = parseFloat(data.list[0].khaiValue);
                                    that.log.debug('Current khai grade is: %s', khai_grade);
                                    that.log.debug('Current khai value is: %s', that.conditions.aqi);
                                }

                                if (data.list[0].pm10Value != "-") {
                                    pm10_grade = that.convertPm10Grade(data.list[0].pm10Value);
                                    that.conditions.pm10 = parseFloat(data.list[0].pm10Value);
                                    that.log.debug('Current PM10 density is: %s', that.conditions.pm10);
                                    that.sensorService
                                        .getCharacteristic(Characteristic.PM10Density)
                                        .setValue(that.conditions.pm10); 
                                    that.log.debug('Current pm10 grade is: %s', pm10_grade);
                                }
                                if (data.list[0].pm25Value != "-") {
                                    pm25_grade = that.convertPm25Grade(data.list[0].pm25Value);
                                    that.conditions.pm25 = parseFloat(data.list[0].pm25Value);
                                    that.log.debug('Current PM25 density is: %s', that.conditions.pm25);
                                    that.sensorService
                                        .getCharacteristic(Characteristic.PM2_5Density)
                                        .setValue(that.conditions.pm25); 
                                    that.log.debug('Current pm25 grade is: %s', pm25_grade);
                                }
                                if (data.list[0].o3Value != "-") {
                                    that.conditions.o3 = parseFloat(data.list[0].o3Value) * 1000;
                                    that.log.debug('Current Ozon density is: %s', that.conditions.o3);
                                    that.sensorService
                                        .getCharacteristic(Characteristic.OzoneDensity)
                                        .setValue(that.conditions.o3); 
                                }
                                if (data.list[0].no2Value != "-") {
                                    that.conditions.no2 = parseFloat(data.list[0].no2Value) * 1000;
                                    that.log.debug('Current NO2 density is: %s', that.conditions.no2);
                                    that.sensorService
                                        .getCharacteristic(Characteristic.NitrogenDioxideDensity)
                                        .setValue(that.conditions.no2); 
                                }
                                if (data.list[0].so2Value != "-") {
                                    that.conditions.so2 = parseFloat(data.list[0].so2Value) * 1000;
                                    that.log.debug('Current SO2 density is: %s', that.conditions.so2);
                                    that.sensorService
                                        .getCharacteristic(Characteristic.SulphurDioxideDensity)
                                        .setValue(that.conditions.so2); 
                                }
                                if (data.list[0].coValue != "-") {
                                    that.conditions.co = parseFloat(data.list[0].coValue);
                                    that.log.debug('Current CO density is: %s', that.conditions.co);
                                    that.sensorService
                                        .getCharacteristic(Characteristic.CarbonMonoxideLevel)
                                        .setValue(that.conditions.co); 
                                }

                                that.conditions.air_quality = that.getCreteriaGrade(that.creteria, khai_grade, pm10_grade, pm25_grade);

                                that.sensorService
                                    .getCharacteristic(Characteristic.Version)
                                    .setValue(data.list[0].dataTime); 
                                
                            break;
                        }
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


    convertKhaiGrade: function (value) {
        var grade;
        if (!value) {
            grade = Characteristic.AirQuality.UNKNOWN;
        } else if (value >= 201) {
            grade = Characteristic.AirQuality.POOR;
        } else if (value >= 151) {
            grade = Characteristic.AirQuality.INFERIOR;
        } else if (value >= 101) {
            grade = Characteristic.AirQuality.FAIR;
        } else if (value >= 51) {
            grade = Characteristic.AirQuality.GOOD;
        } else if (value >= 0) {
            grade = Characteristic.AirQuality.EXCELLENT;
        } else {
            grade = Characteristic.AirQuality.UNKNOWN;
        }
        return grade;
    },

    convertPm10Grade: function (value) {
        var grade;
        if (!value) {
            grade = Characteristic.AirQuality.UNKNOWN;
        } else if (value >= 151) {
            grade = Characteristic.AirQuality.POOR;
        } else if (value >= 81) {
            grade = Characteristic.AirQuality.INFERIOR;
        } else if (value >= 31) {
            grade = Characteristic.AirQuality.FAIR;
        } else if (value >= 1) {
            grade = Characteristic.AirQuality.GOOD;
        } else if (value == 0) {
            grade = Characteristic.AirQuality.EXCELLENT;
        } else {
            grade = Characteristic.AirQuality.UNKNOWN;
        }
        return grade;
    },

    convertPm25Grade: function (value) {
        var grade;
        if (!value) {
            grade = Characteristic.AirQuality.UNKNOWN;
        } else if (value >= 76) {
            grade = Characteristic.AirQuality.POOR;
        } else if (value >= 36) {
            grade = Characteristic.AirQuality.INFERIOR;
        } else if (value >= 16) {
            grade = Characteristic.AirQuality.FAIR;
        } else if (value >= 1) {
            grade = Characteristic.AirQuality.GOOD;
        } else if (value == 0) {
            grade = Characteristic.AirQuality.EXCELLENT;
        } else {
            grade = Characteristic.AirQuality.UNKNOWN;
        }
        return grade;
    },

    getCreteriaGrade: function (creteria, khai_grade, pm10_grade, pm25_grade) {
        var grade = Characteristic.AirQuality.UNKNOWN;

        if(creteria.search('khai') != -1 && khai_grade != Characteristic.AirQuality.UNKNOWN)
        {
            grade = khai_grade;
        }

        if(creteria.search('pm10') != -1 && pm10_grade != Characteristic.AirQuality.UNKNOWN)
        {
            if( pm10_grade > grade )
            {
                grade = pm10_grade;
            }
        }

        if(creteria.search('pm25') != -1 && pm25_grade != Characteristic.AirQuality.UNKNOWN)
        {
            if( pm25_grade > grade )
            {
                grade = pm25_grade;
            }
        }
        
        return grade;
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
            .setCharacteristic(Characteristic.Manufacturer, 'slasherLee')
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.SerialNumber, this.station);

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
}
