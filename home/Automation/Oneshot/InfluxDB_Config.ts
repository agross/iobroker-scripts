const dryRun: boolean = false;

function room(id: string): string {
  return (getObject(id, 'rooms') as any).enumNames[0].en;
}

function check(enabledDataPoints: {}, id: string, expected: {}) {
  const actual = enabledDataPoints[id];

  if (JSON.stringify(expected) === JSON.stringify(actual)) {
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
    )} but got ${JSON.stringify(actual, null, 2)}`,
    'warn',
  );

  if (dryRun) {
    return;
  }

  sendTo(
    'influxdb.0',
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

sendTo('influxdb.0', 'getEnabledDPs', {}, (enabledDataPoints: {}) => {
  $('state[id=zigbee.*.available]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Availability`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.battery]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Battery Percentage`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.link_quality]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Link Quality`,
    };

    check(enabledDataPoints, id, expect);
  });

  // Motion sensor.
  $('state[id=zigbee.*.illuminance]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Illumination`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.occupancy]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Presence`,
    };

    check(enabledDataPoints, id, expect);
  });

  // Door contacts.
  $('state[id=zigbee.*.opened]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Open`,
    };

    check(enabledDataPoints, id, expect);
  });

  // Temperature, humidity and pressure sensor.
  $('state[id=zigbee.*.temperature]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Temperature`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.humidity]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Humidity`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=zigbee.*.pressure]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Pressure`,
    };

    check(enabledDataPoints, id, expect);
  });

  // Lights.
  $('state[id=zigbee.*.state](functions=light)').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Light On`,
    };

    check(enabledDataPoints, id, expect);
  });

  // Power plugs.
  $('state[id=alias.0.mqtt.*.gosund-sp111-*.state]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Power`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.mqtt.*.gosund-sp111-*.power]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Power Watts`,
    };

    check(enabledDataPoints, id, expect);
  });

  // HomeMatic.
  $('state[id=hm-rpc.*.0.UNREACH]').each(id => {
    if (id.match(/^admin\./) || id.match(/_ALARM$/)) {
      return;
    }

    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Unreachable`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.0.RSSI_PEER]').each(id => {
    if (id.match(/^admin\./)) {
      return;
    }

    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} RSSI Peer`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.0.RSSI_DEVICE]').each(id => {
    if (id.match(/^admin\./)) {
      return;
    }

    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} RSSI Device`,
    };

    check(enabledDataPoints, id, expect);
  });

  // HomeMatic battery-powered devices.
  $('state[id=hm-rpc.*.0.LOW_BAT]').each(id => {
    if (id.match(/^admin\./) || id.match(/_ALARM$/)) {
      return;
    }

    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Low Battery`,
    };

    check(enabledDataPoints, id, expect);
  });

  // HomeMatic thermostats.
  $('state[id=hm-rpc.*.1.ACTUAL_TEMPERATURE]').each(id => {
    if (id.match(/^admin\./) || id.match(/_STATUS$/)) {
      return;
    }

    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Current Temperature`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.1.HUMIDITY]').each(id => {
    if (id.match(/^admin\./) || id.match(/_STATUS$/)) {
      return;
    }

    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Humidity`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.1.SET_POINT_TEMPERATURE]').each(id => {
    if (id.match(/^admin\./)) {
      return;
    }

    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Target Temperature`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.1.LEVEL]').each(id => {
    if (id.match(/^admin\./) || id.match(/_STATUS$/)) {
      return;
    }

    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Valve`,
    };

    check(enabledDataPoints, id, expect);
  });

  // HomeMatic presence detectors.
  $('state[id=hm-rpc.*.1.ILLUMINATION]').each(id => {
    if (id.match(/^admin\./) || id.match(/_STATUS$/)) {
      return;
    }

    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Illumination`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=hm-rpc.*.1.PRESENCE_DETECTION_STATE]').each(id => {
    if (id.match(/^admin\./)) {
      return;
    }

    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Presence`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=lgtv.*.states.power]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `Living Room TV Power`,
    };

    check(enabledDataPoints, id, expect);
  });

  // Car.
  $('state[id=alias.0.vw-connect.0.*.mileage]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Mileage`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.oil-level]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Oil Level`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.adblue-range]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} AdBlue Range`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.fuel-level]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Fuel Level`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.fuel-range]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Fuel Range`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.locked]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Locked`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.vw-connect.0.*.parking-brake-engaged]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Parking Break Engaged`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=0_userdata.0.vw-connect.0.*.windows-closed]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${Device.deviceName(id)} Windows Closed`,
    };

    check(enabledDataPoints, id, expect);
  });

  // Raspberry Pi.
  $('state[id=info.0.sysinfo.cpu.temperature.main]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: 'Raspberry Pi Temperature',
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=system.host.iobroker.load]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: 'Raspberry Pi Load',
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=info.0.sysinfo.memory.info.available]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: 'Raspberry Pi Memory Available',
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=info.0.sysinfo.cpu.currentSpeed.avgSpeed]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: 'Raspberry Pi CPU Speed',
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=system.host.iobroker.uptime]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: 'Raspberry Pi Uptime',
    };

    check(enabledDataPoints, id, expect);
  });

  // Fuel prices.
  $('state[id=tankerkoenig.*.stations.*.diesel.short]').each(id => {
    if (id.match(/\.cheapest\./)) {
      return;
    }

    const stationNameId = id.split('.').slice(0, -2).concat(['name']).join('.');

    if (!existsState(stationNameId)) {
      return;
    }
    const stationName = getState(stationNameId).val;

    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 500,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `Diesel Price ${stationName}`,
    };

    check(enabledDataPoints, id, expect);
  });
});

stopScript(undefined);
