function deviceId(id: string, initialId?: string): string {
  const _deviceId = id.replace(/\.[^.]*$/, '');
  if (_deviceId == id) {
    return initialId;
  }

  const device = getObject(_deviceId);

  if (!device || device.type !== 'device') {
    // Search parent.
    return deviceId(_deviceId, initialId ? initialId : id);
  }

  return _deviceId;
}

function getEnumIds(id: string, kind: string): string[] {
  return (getObject(id, kind) as any).enumIds;
}

function alias(device: string, state?: string) {
  const root = `alias.0.${device}`;
  if (!state) {
    return root;
  }

  return `${root}.${state}`;
}

function lovelace(id: string) {
  return id.replace(/[\.\s\-]/g, '_');
}

const enumsToDeviceAliases: { [enumId: string]: string[] } = {};

// HomeMatic shutters.
$('state[id=*.4.LEVEL]{CONTROL=BLIND_VIRTUAL_RECEIVER.LEVEL}').each(stateId => {
  const device = deviceId(stateId);

  const aliases: { [state: string]: any } = {
    level: {
      alias: {
        id: { read: `${device}.3.LEVEL`, write: `${device}.4.LEVEL` },
        read: 'Math.round(val)',
      },
      role: 'value.blind',
      type: 'number',
      unit: '%',
      min: 0,
      max: 100,
      name: 'Level of shutters',
      custom: {
        'lovelace.0': {
          enabled: true,
          entity: 'input_number',
          name: `${lovelace(device)}_level`,
        },
      },
    },
    close: {
      alias: {
        id: { read: `${device}.4.ACTIVITY_STATE`, write: `${device}.4.LEVEL` },
        read: `val === 2`,
        write: 'val = 0',
      },
      role: 'button.close',
      type: 'boolean',
      name: 'Close shutters completely',
      read: true,
      write: true,
      def: false,
      custom: {
        'lovelace.0': {
          enabled: true,
          entity: 'switch',
          name: `${lovelace(device)}_close`,
        },
      },
    },
    open: {
      alias: {
        id: { read: `${device}.4.ACTIVITY_STATE`, write: `${device}.4.LEVEL` },
        read: `val === 1`,
        write: 'val = 100',
      },
      role: 'button.open',
      type: 'boolean',
      name: 'Open shutters completely',
      read: true,
      write: true,
      def: false,
      custom: {
        'lovelace.0': {
          enabled: true,
          entity: 'switch',
          name: `${lovelace(device)}_open`,
        },
      },
    },
    stop: {
      alias: {
        id: { read: `${device}.3.PROCESS`, write: `${device}.4.STOP` },
        read: 'false',
        write: 'true',
      },
      role: 'button.stop',
      type: 'boolean',
      name: 'Stop movement',
      read: true,
      write: true,
      def: false,
      custom: {
        'lovelace.0': {
          enabled: true,
          entity: 'switch',
          name: `${lovelace(device)}_stop`,
        },
      },
    },
    tilt_level: {
      alias: {
        id: { read: `${device}.3.LEVEL_2`, write: `${device}.4.LEVEL_2` },
      },
      role: 'value.blind',
      type: 'number',
      unit: '%',
      min: 0,
      max: 100,
      name: 'Tilt level of slats',
      custom: {
        'lovelace.0': {
          enabled: true,
          entity: 'input_number',
          name: `${lovelace(device)}_tilt_level`,
        },
      },
    },
    tilt_close: {
      alias: {
        id: {
          read: `${device}.4.ACTIVITY_STATE`,
          write: `${device}.4.LEVEL_2`,
        },
        read: `val === 2`,
        write: 'val = 0',
      },
      role: 'button.close',
      type: 'boolean',
      name: 'Tilt slats into closed position',
      read: true,
      write: true,
      def: false,
      custom: {
        'lovelace.0': {
          enabled: true,
          entity: 'switch',
          name: `${lovelace(device)}_tilt_close`,
        },
      },
    },
    tilt_open: {
      alias: {
        id: {
          read: `${device}.4.ACTIVITY_STATE`,
          write: `${device}.4.LEVEL_2`,
        },
        read: `val === 1`,
        write: 'val = 100',
      },
      role: 'button.open',
      type: 'boolean',
      name: 'Tilt slats into open position',
      read: true,
      write: true,
      def: false,
      custom: {
        'lovelace.0': {
          enabled: true,
          entity: 'switch',
          name: `${lovelace(device)}_tilt_open`,
        },
      },
    },
  };

  const skeleton: iobJS.StateObject = {
    type: 'state',
    native: {},
    common: {} as iobJS.StateCommon,
  };

  const channel: iobJS.Object = {
    type: 'channel',
    native: {},
    common: { name: device, role: 'blind' },
  };

  const deviceAlias = alias(device);

  setObject(deviceAlias, channel);

  getEnumIds(stateId, 'rooms')
    .concat(getEnumIds(stateId, 'functions'))
    .reduce((acc, enumId) => {
      if (!acc.hasOwnProperty(enumId)) {
        acc[enumId] = [];
      }

      acc[enumId].push(deviceAlias);
      return acc;
    }, enumsToDeviceAliases);

  Object.entries(aliases).forEach(([state, common]) => {
    let dup: iobJS.StateObject = Object.assign({}, skeleton);
    Object.assign(dup, { common: common });

    setObject(alias(device, state), dup);
  });
});

for (let [enumId, deviceAliases] of Object.entries(enumsToDeviceAliases)) {
  const _enum = getObject(enumId);
  const common = (_enum.common as unknown) as { members: string[] };

  const members = Array.from(common.members);
  deviceAliases.forEach(deviceAlias => {
    if (!members.includes(deviceAlias)) {
      log(`Appending ${deviceAlias} to ${enumId}`);
      members.push(deviceAlias);
    }
  });

  if (members.length != common.members.length) {
    log(`Saving ${enumId}`);
    extendObject(enumId, { common: { members: members } });
  }
}

// When only tilt is set we also need to set the current level, otherwise the
// new tilt is not applied.
$('state[id=*.4.LEVEL_2]{CONTROL=BLIND_VIRTUAL_RECEIVER.LEVEL_2}').each(
  stateId => {
    on({ id: stateId, change: 'ne', ack: false }, event => {
      const setLevel = event.id.replace(/_2$/, '');
      const getLevel = setLevel.replace('.4.', '.3.');

      var currentLevel = getState(getLevel).val;

      log(`Tilt level: ${event.state.val}, reapplying level ${currentLevel}`);
      setState(setLevel, currentLevel);
    });
  },
);

// Set booleans to false when state becomes stable (i.e. shutter stop moving).
on({ id: /^hm-rpc\..*\.4\.PROCESS$/, change: 'ne', ack: true }, event => {
  if (event.newState.val !== 0) {
    return;
  }

  log(`${event.id} stopped moving`);

  const device = deviceId(event.id);
  ['close', 'open', 'stop', 'tilt_close', 'tilt_open'].forEach(state => {
    // setState(alias(device, state), false),
  });
});
