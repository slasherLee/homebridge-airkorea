# homebridge-airkorea

Homebridge plugin for the AirKorea API

## Installation

1. Install homebridge using the instructions at https://github.com/nfarina/homebridge#installation
2. Install this plugin using: `npm install -g https://github.com/slasherLee/homebridge-airkorea`
3. Register for an account and get an API key at http://openapi.airkorea.or.kr
4. Update the Homebridge configuration file

## Configuration

Example config.json:

```js
"accessories": [
  {
    "accessory": "AirKorea",
    "name": "AirKorea",
    "sensor": "air_quality",
    "api_key": "",
    "station": "",
    "polling": true
  }
],
```

## Details

Field | Required | Default | Description
:--- | :---: | :---: | :---
`accessory` | yes | `AirKorea` | Must always be `AirKorea`
`name` | yes | `AirKorea` | Can be specified by user
`api_key` | yes | | Obtain from http://openapi.airkorea.or.kr
`sensor` | no | `air_quality` | Must be `air_quality`
`station` | no | | Search station name from http://openapi.arikorea.or.kr 
`polling` | no | `false` | Must be `true` or `false` (must be a boolean, not a string)
