import util from 'util';

const config = {
  dryRun: false,
  influxDbAdapterId: 'influxdb.0',
  default: {
    enabled: true,
    debounce: 500, // Duplicated for some reason.
    debounceTime: 500, // This is what is displayed on the UI.
    blockTime: 0,
    changesOnly: true,
    changesRelogInterval: 600,
    changesMinDelta: 0,
    storageType: false, // Automatic.
    ignoreBelowNumber: '',
    disableSkippedValueLogging: false,
    enableDebugLogs: false,
  },
};

function check(enabledDataPoints: {}, id: string, expected: {}) {
  const actual = enabledDataPoints[id];
  const actualShrunkDownToExpected = Utils.shrink(actual, expected);

  if (
    actualShrunkDownToExpected &&
    util.isDeepStrictEqual(
      JSON.parse(JSON.stringify(expected)),
      JSON.parse(JSON.stringify(actualShrunkDownToExpected)),
    )
  ) {
    return;
  }

  let name: string;
  try {
    name = Device.deviceName(id);
  } catch {
    // In the case of "system.*" there is no device.
    name = id;
  }

  log(
    `${name} (${id}): expected ${JSON.stringify(
      expected,
      null,
      2,
    )} but got ${JSON.stringify(actualShrunkDownToExpected, null, 2)}`,
    'warn',
  );

  if (config.dryRun) {
    return;
  }

  sendTo(
    config.influxDbAdapterId,
    'enableHistory',
    {
      id: id,
      options: expected,
    },
    result => {
      if (result.error) {
        log(
          `${name}: Error fixing ${id}: ${JSON.stringify(result.error)}`,
          'error',
        );
      }
      if (result.success) {
        log(`${name}: Fixed ${id}`);
      }
    },
  );
}

sendTo(
  config.influxDbAdapterId,
  'getEnabledDPs',
  {},
  (enabledDataPoints: {}) => {
    zigbeeCommon(enabledDataPoints);
    zigbeeMotionSensors(enabledDataPoints);
    zigbeeDoorAndWindowContacts(enabledDataPoints);
    zigbeeTemperatureHumidityAndPressureSensors(enabledDataPoints);
    zigbeeVibrationSensors(enabledDataPoints);
    zigbeeSmokeDetectors(enabledDataPoints);
    zigbeeLights(enabledDataPoints);
    zigbeeValves(enabledDataPoints);

    homeMaticCommon(enabledDataPoints);
    homeMaticThermostats(enabledDataPoints);
    homeMaticPresenceDetectors(enabledDataPoints);

    powerPlugs(enabledDataPoints);
    mqttDevicesWithTemperature(enabledDataPoints);

    car(enabledDataPoints);
    fuelPrices(enabledDataPoints);

    alarm(enabledDataPoints);
    presence(enabledDataPoints);

    marstek(enabledDataPoints);
    solarPrediction(enabledDataPoints);

    $('state[id=lgtv.*.states.power]').each(id => {
      const expect = Object.assign({}, config.default, {
        aliasId: `Living Room TV Power State`,
      });

      check(enabledDataPoints, id, expect);
    });
  },
);

function zigbeeCommon(enabledDataPoints: {}) {
  $('state[id=zigbee.*.available]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Availability`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.battery]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Battery Percentage`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.link_quality]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Link Quality`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function zigbeeMotionSensors(enabledDataPoints: {}) {
  $('state[id=zigbee.*.illuminance]').each(id => {
    const rawIlluminance = `${id}_raw`;
    if (existsState(rawIlluminance)) {
      id = rawIlluminance;
    }

    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Illumination`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.occupancy]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Presence`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function zigbeeDoorAndWindowContacts(enabledDataPoints: {}) {
  $('state[id=zigbee.*.opened]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Open`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function zigbeeTemperatureHumidityAndPressureSensors(enabledDataPoints: {}) {
  $('state[id=zigbee.*.temperature]').each(id => {
    const device = Device.id(id);
    if (device && getObject(device).common.type === 'RTCGQ11LM') {
      // Aqara Motion Sensor does not report temperature despite
      // iobroker.zigbee thinking it does.
      return;
    }

    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Temperature`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.humidity]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Humidity`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.soil_moisture]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Soil Moisture`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.pressure]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Pressure`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function zigbeeVibrationSensors(enabledDataPoints: {}) {
  $('state[id=zigbee.*.drop]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Drop`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.tilt]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Tilt`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.vibration]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Vibration`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function zigbeeSmokeDetectors(enabledDataPoints: {}) {
  $('state[id=zigbee.*.smoke]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Smoke Detected`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.device_temperature]').each(id => {
    const device = Device.id(id);
    if (device && getObject(device).common.type === 'JY-GZ-01AQ') {
      // Aqara Smart Smoke Detector does not report temperature despite
      // iobroker.zigbee thinking it does.
      return;
    }

    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Device Temperature`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function zigbeeLights(enabledDataPoints: {}) {
  $('state[id=zigbee.*.state](functions=light)').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Light On`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function zigbeeValves(enabledDataPoints: {}) {
  const devices = [
    ...$('state[id=zigbee.*.auto_close_when_water_shortage]'),
  ].map(x => ({
    id: Device.id(x),
    name: Device.deviceName(x),
  }));

  devices.forEach(async device => {
    const id = `${device.id}.state`;

    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Valve Open`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function homeMaticCommon(enabledDataPoints: {}) {
  $('state[id=hm-rpc.*.0.UNREACH]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Unreachable`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.0.RSSI_PEER]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} RSSI Peer`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.0.RSSI_DEVICE]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} RSSI Device`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.0.LOW_BAT]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Low Battery`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.0.DUTY_CYCLE_LEVEL]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `HomeMatic Duty Cycle`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.0.CARRIER_SENSE_LEVEL]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `HomeMatic Carrier Sense`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function homeMaticThermostats(enabledDataPoints: {}) {
  $('state[id=hm-rpc.1.*.1.ACTUAL_TEMPERATURE]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Current Temperature`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.1.*.1.HUMIDITY]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Humidity`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.1.*.1.SET_POINT_TEMPERATURE]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Target Temperature`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.1.*.1.LEVEL]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Valve Level`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.1.*.10.STATE]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Valve Open`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function homeMaticPresenceDetectors(enabledDataPoints: {}) {
  $('state[id=hm-rpc.*.1.ILLUMINATION]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Illumination`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.1.PRESENCE_DETECTION_STATE]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Presence`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function powerPlugs(enabledDataPoints: {}) {
  [
    ...$('state[id=alias.0.mqtt.*.gosund-sp111-*.state]'),
    ...$('state[id=alias.0.mqtt.*.nous-a1t-*.state]'),
  ].forEach(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Power State`,
    });

    check(enabledDataPoints, id, expect);
  });

  [
    ...$('state[id=alias.0.mqtt.*.gosund-sp111-*.power]'),
    ...$('state[id=alias.0.mqtt.*.nous-a1t-*.power]'),
  ].forEach(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Power Usage`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function mqttDevicesWithTemperature(enabledDataPoints: {}) {
  $('state[id=alias.0.mqtt.*.device_temperature]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Device Temperature`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function car(enabledDataPoints: {}) {
  $('state[id=alias.0.vw-connect.0.*.mileage]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Mileage`,
      ignoreAboveNumber: 2147483646,
      ignoreZero: true,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.oil-level]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Oil Level`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.adblue-range]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} AdBlue Range`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.fuel-level]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Fuel Level`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.fuel-range]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Fuel Range`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.locked]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Locked`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.parking-brake-engaged]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Parking Break Engaged`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=0_userdata.0.vw-connect.0.*.windows-closed]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Windows Closed`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.latitude]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Latitude`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.longitude]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Longitude`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.geohash]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Geohash`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.is-moving]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Moving`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function fuelPrices(enabledDataPoints: {}) {
  $('state[id=tankerkoenig.*.stations.*.diesel.short]').each(id => {
    if (id.match(/\.cheapest\./)) {
      return;
    }

    const stationNameId = id.split('.').slice(0, -2).concat(['name']).join('.');

    if (!existsState(stationNameId)) {
      return;
    }
    const stationName = getState(stationNameId).val;

    const expect = Object.assign({}, config.default, {
      aliasId: `Diesel Price ${stationName}`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function alarm(enabledDataPoints: {}) {
  $('state[id=0_userdata.0.alarm-enabled]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: 'Alarm Enabled',
    });

    check(enabledDataPoints, id, expect);
  });
}

function presence(enabledDataPoints: {}) {
  $('state[id=0_userdata.0.presence]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: 'Presence Detected',
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=0_userdata.0.long-term-absence]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: 'Long-Term Absence',
    });

    check(enabledDataPoints, id, expect);
  });
}

function marstek(enabledDataPoints: {}) {
  const name = 'Marstek Venus A';

  const numeric = {
    ...config.default,
    ...{
      storageType: 'Number',
    },
  };

  const boolean = {
    ...config.default,
    ...{
      storageType: 'Boolean',
    },
  };

  $('state[id=marstek-venus.*.battery.capacity]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Battery Capacity`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.battery.soc]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Battery State Of Charge`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.battery.temperature]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Battery Temperature`,
        ignoreAboveNumber: 100,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.battery.chargingAllowed]').each(id => {
    const expect = {
      ...boolean,
      ...{
        aliasId: `${name} Battery Charging Allowed`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.battery.dischargingAllowed]').each(id => {
    const expect = {
      ...boolean,
      ...{
        aliasId: `${name} Battery Discharging Allowed`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.control.mode]').each(id => {
    const expect = {
      ...config.default,
      ...{ storageType: 'String' },
      ...{
        aliasId: `${name} Control Mode`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.energy.gridExport]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Total Grid Output Energy`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.energy.gridImport]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Total Grid Input Energy`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.energy.loadTotal]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Total Load (Or Off-Grid) Energy Consumed`,
      },
    };

    // Always 0.
    // check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.energy.pvTotal]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Total Solar Energy Generated`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.energymeter.ctState]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Power Meter Connection`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.energymeter.power*]').each(id => {
    function letterIndex(c: string) {
      return c.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    }

    const match = id.match(/[ABC]$/);
    if (!match) {
      return undefined;
    }

    const index = letterIndex(id.at(-1)!);

    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} L${index} Grid Power Usage`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.energymeter.powerTotal]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Grid Power Usage`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  const extractChannel = (id: string) => {
    const match = id.match(/\.(pv\d+)/);
    if (!match) {
      return undefined;
    }
    return match[1].toUpperCase();
  };

  $('state[id=marstek-venus.*.power.pv][role=value.power]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Solar Charging Power`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.power.grid][role=value.power]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Grid-Tied Power`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.power.load][role=value.power]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Off-Grid Power`,
      },
    };

    // Always 0.
    // check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.power.pv*][role=value.power]').each(id => {
    const channel = extractChannel(id);
    if (!channel) return;

    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} ${channel} Power`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.power.pv*Current][role=value.current]').each(
    id => {
      const channel = extractChannel(id);
      if (!channel) return;

      const expect = {
        ...numeric,
        ...{
          aliasId: `${name} ${channel} Current`,
        },
      };

      check(enabledDataPoints, id, expect);
    },
  );

  $('state[id=marstek-venus.*.power.pv*State][role=indicator]').each(id => {
    const channel = extractChannel(id);
    if (!channel) return;

    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} ${channel} State`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=marstek-venus.*.power.pv*Voltage][role=value.voltage]').each(
    id => {
      const channel = extractChannel(id);
      if (!channel) return;

      const expect = {
        ...numeric,
        ...{
          aliasId: `${name} ${channel} Voltage`,
        },
      };

      check(enabledDataPoints, id, expect);
    },
  );
}

function solarPrediction(enabledDataPoints: {}) {
  const name = 'Solar Energy Predicted';

  const numeric = {
    ...config.default,
    ...{
      storageType: 'Number',
    },
  };

  $('state[id=solarprognose.0.forecast.00.energy]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Today`,
      },
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=solarprognose.0.forecast.01.energy]').each(id => {
    const expect = {
      ...numeric,
      ...{
        aliasId: `${name} Tomorrow`,
      },
    };

    check(enabledDataPoints, id, expect);
  });
}

stopScript(undefined);
