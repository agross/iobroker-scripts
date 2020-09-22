function getObjectDefinition(): ObjectDefinitionRoot {
  const deviceId: (id: string, initialId?: string) => string = (
    id,
    initialId?,
  ) => {
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
  };

  const deviceName: (id: string) => string = (id: string) => {
    const device = getObject(deviceId(id));

    if (!device) {
      return id;
    }

    return device.common?.name;
  };

  const shutters: ObjectDefinitionRoot = {};

  // HomeMatic shutters.
  $('state[id=*.6.LEVEL]{CONTROL=BLIND_VIRTUAL_RECEIVER.LEVEL}').each(
    stateId => {
      const device = deviceId(stateId);

      const deviceStates: {
        [id: string]: iobJS.StateCommon &
          iobJS.AliasCommon &
          iobJS.CustomCommon;
      } = {
        level: {
          alias: {
            id: { read: `${device}.3.LEVEL`, write: `${device}.4.LEVEL` },
            read: 'Math.round(val)',
            write: 'val',
          },
          role: 'level.blind',
          type: 'number',
          unit: '%',
          min: 0,
          max: 100,
          name: 'Level of shutters',
          read: true,
          write: true,
          custom: {
            'lovelace.0': {
              enabled: true,
              entity: 'input_number',
              name: `${deviceName(stateId)} Level`,
            },
          },
        },
        close: {
          alias: {
            id: {
              read: `${device}.4.ACTIVITY_STATE`,
              write: `${device}.4.LEVEL`,
            },
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
              name: `${deviceName(stateId)}_Close`,
            },
          },
        },
        open: {
          alias: {
            id: {
              read: `${device}.4.ACTIVITY_STATE`,
              write: `${device}.4.LEVEL`,
            },
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
              name: `${deviceName(stateId)}_Open`,
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
              name: `${deviceName(stateId)}_Stop`,
            },
          },
        },
        tilt_level: {
          alias: {
            id: { read: `${device}.3.LEVEL_2`, write: `${device}.4.LEVEL_2` },
            read: 'Math.round(val)',
            write: 'val',
          },
          role: 'value.blind',
          type: 'number',
          unit: '%',
          min: 0,
          max: 100,
          name: 'Tilt level of slats',
          read: true,
          write: true,
          custom: {
            'lovelace.0': {
              enabled: true,
              entity: 'input_number',
              name: `${deviceName(stateId)}_Tilt_Level`,
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
              name: `${deviceName(stateId)}_Tilt_Close`,
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
              name: `${deviceName(stateId)}_Tilt_Open`,
            },
          },
        },
      };

      shutters[device] = {
        type: 'device',
        native: {},
        common: { name: deviceName(stateId), role: 'blind' },
        enumIds: ObjectCreator.getEnumIds(stateId, 'rooms', 'functions'),
        nested: Object.entries(deviceStates).reduce((acc, [id, common]) => {
          acc[id] = { type: 'state', native: {}, common: common };
          return acc;
        }, {} as ObjectDefinitionRoot),
      };
    },
  );

  return shutters;
}

ObjectCreator.create(getObjectDefinition(), 'alias.0');

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

// Maybe need to set booleans to false when state becomes stable (i.e. shutter
// stopped moving).
on({ id: /^hm-rpc\..*\.4\.PROCESS$/, change: 'ne', ack: true }, event => {
  if (event.state.val !== 0) {
    return;
  }

  log(`${event.id} stopped moving`);
});
