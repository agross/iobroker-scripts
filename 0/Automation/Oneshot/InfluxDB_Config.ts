const dryRun: boolean = false;

function deviceName(id: string, initialId?: string): string {
  const deviceId = id.replace(/\.[^.]*$/, '');
  if (deviceId == id) {
    return initialId;
  }

  const device = getObject(deviceId);

  if (
    !device ||
    (device.type !== 'device' && device.common.role !== 'device')
  ) {
    // Search parent.
    return deviceName(deviceId, initialId ? initialId : id);
  }

  return device.common.name;
}

function room(id: string): string {
  return (getObject(id, 'rooms') as any).enumNames[0].en;
}

function check(enabledDataPoints: {}, id: string, expected: {}) {
  const actual = enabledDataPoints[id];

  if (JSON.stringify(expected) === JSON.stringify(actual)) {
    return;
  }

  const name = deviceName(id) || id;

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
      debounce: 0,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Availability`,
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
      aliasId: `${deviceName(id)} Battery Percentage`,
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
      aliasId: `${deviceName(id)} Link Quality`,
    };

    check(enabledDataPoints, id, expect);
  });

  // Door contacts.
  $('state[id=zigbee.*.opened]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 0,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Open`,
    };

    check(enabledDataPoints, id, expect);
  });

  // Lights.
  $('state[id=zigbee.*.state](functions=Light)').each(id => {
    const expect = {
      enabled: true,
      changesOnly: false,
      debounce: 0,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Light On`,
    };

    check(enabledDataPoints, id, expect);
  });

  // Power plugs.
  $('state[id=alias.0.mqtt.*.gosund-sp111-*.state]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 0,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Power`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=alias.0.mqtt.*.gosund-sp111-*.power]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 0,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Power Watts`,
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
      debounce: 0,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Unreachable`,
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
      debounce: 0,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} RSSI Peer`,
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
      debounce: 0,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} RSSI Device`,
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
      debounce: 0,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Low Battery`,
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
      debounce: 0,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Current Temperature`,
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
      debounce: 0,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Humidity`,
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
      debounce: 0,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Target Temperature`,
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
      debounce: 0,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Valve`,
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
      debounce: 0,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Illumination`,
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
      debounce: 0,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `${deviceName(id)} Presence`,
    };

    check(enabledDataPoints, id, expect);
  });

  $('state[id=lgtv.*.states.power]').each(id => {
    const expect = {
      enabled: true,
      changesOnly: true,
      debounce: 0,
      maxLength: 10,
      retention: 63072000,
      changesRelogInterval: 60,
      changesMinDelta: 0,
      storageType: false,
      aliasId: `Living Room TV Power`,
    };

    check(enabledDataPoints, id, expect);
  });
});

stopScript(undefined);
