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

    homeMaticCommon(enabledDataPoints);
    homeMaticThermostats(enabledDataPoints);
    homeMaticPresenceDetectors(enabledDataPoints);

    powerPlugs(enabledDataPoints);
    mqttDevicesWithTemperature(enabledDataPoints);

    car(enabledDataPoints);
    fuelPrices(enabledDataPoints);

    system(enabledDataPoints);

    alarm(enabledDataPoints);
    presence(enabledDataPoints);

    $('state[id=lgtv.*.states.power]').each(id => {
      const expect = Object.assign({}, config.default, {
        aliasId: `Living Room TV Power`,
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
      aliasId: `${Device.deviceName(id)} Temperature`,
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
  $('state[id=alias.0.mqtt.*.gosund-sp111-*.state]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Power`,
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.mqtt.*.gosund-sp111-*.power]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Power Watts`,
    });

    check(enabledDataPoints, id, expect);
  });
}

function mqttDevicesWithTemperature(enabledDataPoints: {}) {
  $('state[id=alias.0.mqtt.*.device_temperature]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: `${Device.deviceName(id)} Temperature`,
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

function system(enabledDataPoints: {}) {
  $('state[id=info.0.sysinfo.cpu.temperature.main]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: 'Raspberry Pi Temperature',
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=system.host.iobroker.load]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: 'Raspberry Pi Load',
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=info.0.sysinfo.memory.info.available]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: 'Raspberry Pi Memory Available',
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=info.0.sysinfo.cpu.currentSpeed.avgSpeed]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: 'Raspberry Pi CPU Speed',
    });

    check(enabledDataPoints, id, expect);
  });

  $('state[id=system.host.iobroker.uptime]').each(id => {
    const expect = Object.assign({}, config.default, {
      aliasId: 'Raspberry Pi Uptime',
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

stopScript(undefined);
