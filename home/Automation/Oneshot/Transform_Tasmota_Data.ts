function getObjectDefinition(): ObjectDefinitionRoot {
  function deviceId(id: string): string {
    return id.replace(/\.[^.]*$/, '').replace(/\.(cmnd|tele|stat)\./, '.');
  }

  function stateIdToPurpose(stateId: string) {
    const deviceName = stateId.split('.').at(-2);
    log(`Getting purpose of ${stateId} from ${deviceName} at ${Site.location}`);

    if (Site.location === 'Home') {
      switch (deviceName) {
        case 'gosund-sp111-1':
          return 'Living Room Media';

        case 'gosund-sp111-2':
          return 'Kitchen Down Light';

        case 'gosund-sp111-3':
          return 'Bathroom Washing Machine';

        case 'gosund-sp111-4':
          return 'Office Desk';

        case 'nous-a1t-1':
          return 'NAS';
      }
    }

    if (Site.location === 'OGD') {
      switch (deviceName) {
        case 'nous-a1t-1':
          return 'Bathroom Water Heater';

        case 'nous-a1t-2':
          return 'Living Room Heater';

        case 'nous-a1t-3':
          return 'Kitchen Refrigerator';
      }
    }

    throw new Error(
      `No mapping from ${stateId} to purpose from ${deviceName} at ${Site.location}`,
    );
  }

  function lovelaceConfig(stateId: string, type: 'Power' | 'Power Usage'): {} {
    const deviceName = stateId.split('.').at(-2);

    log(
      `Getting Lovelace config of ${stateId} from ${deviceName} at ${Site.location}`,
    );

    let entityType = ObjectCreator.getEnumIds(stateId, 'functions').includes(
      'enum.functions.light',
    )
      ? 'light'
      : 'switch';

    if (type == 'Power Usage') {
      entityType = 'sensor';
    }

    if (Site.location === 'Home') {
      switch (deviceName) {
        case 'gosund-sp111-1':
          return {
            entity: entityType,
            name: Lovelace.id(`${stateIdToPurpose(stateId)} ${type}`),
            attr_device_class: 'outlet',
            attr_icon: 'mdi:music-box-outline',
            attr_friendly_name: 'NAD C350',
          };

        case 'gosund-sp111-2':
          return {
            entity: entityType,
            name: Lovelace.id(`${stateIdToPurpose(stateId)} ${type}`),
            attr_device_class: 'outlet',
            attr_icon: 'mdi:lightbulb',
            attr_friendly_name: stateIdToPurpose(stateId),
          };

        case 'gosund-sp111-3':
          return {
            entity: entityType,
            name: Lovelace.id(`${stateIdToPurpose(stateId)} ${type}`),
            attr_device_class: 'outlet',
            attr_icon: 'mdi:washing-machine',
          };

        case 'gosund-sp111-4':
          return {
            entity: entityType,
            name: Lovelace.id(`${stateIdToPurpose(stateId)} ${type}`),
            attr_device_class: 'outlet',
            attr_icon: 'mdi:desktop-tower-monitor',
          };

        case 'nous-a1t-1':
          return {
            entity: entityType,
            name: Lovelace.id(`${stateIdToPurpose(stateId)} ${type}`),
            attr_device_class: 'outlet',
            attr_icon: 'mdi:nas',
          };
      }
    }

    if (Site.location === 'OGD') {
      switch (deviceName) {
        case 'nous-a1t-1':
          return {
            entity: entityType,
            name: Lovelace.id(`${stateIdToPurpose(stateId)} ${type}`),
            attr_device_class: 'outlet',
            attr_icon: 'mdi:water-boiler',
          };

        case 'nous-a1t-2':
          return {
            entity: entityType,
            name: Lovelace.id(`${stateIdToPurpose(stateId)} ${type}`),
            attr_device_class: 'outlet',
            attr_icon: 'mdi:radiator',
          };

        case 'nous-a1t-3':
          return {
            entity: entityType,
            name: Lovelace.id(`${stateIdToPurpose(stateId)} ${type}`),
            attr_device_class: 'outlet',
            attr_icon: 'mdi:fridge',
          };
      }
    }

    throw new Error(
      `No mapping from ${stateId} to Lovelace config from ${deviceName} at ${Site.location}`,
    );
  }

  return [
    ...$('state[id=*.cmnd.gosund-sp111-*.POWER]'),
    ...$('state[id=*.cmnd.nous-a1t-*.POWER]'),
  ].reduce((acc, stateId) => {
    const device = deviceId(stateId);

    const deviceStates: {
      [id: string]: iobJS.StateCommon;
    } = {
      power: {
        alias: {
          id: stateId
            .replace('.cmnd.', '.tele.')
            .replace(/\.POWER$/, '.SENSOR'),
          read: 'JSON.parse(val).ENERGY.Power',
          // No write function makes this read-only.
        },
        role: 'value',
        type: 'number',
        unit: 'W',
        read: true,
        write: false,
        name: `${stateIdToPurpose(stateId)} Power Usage`,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            ...lovelaceConfig(stateId, 'Power Usage'),
          },
        },
      },
      'negated-state': {
        alias: {
          id: stateId.replace('.cmnd.', '.stat.'),
          read: 'val === "OFF"',
          // No write function makes this read-only.
        },
        role: 'indicator.state',
        type: 'boolean',
        read: true,
        write: false,
        name: `${stateIdToPurpose(
          stateId,
        )} Power (negated for easier toggling in scenes)`,
      },
      state: {
        alias: {
          id: { read: stateId.replace('.cmnd.', '.stat.'), write: stateId },
          read: 'val === "ON"',
          write: 'val === true ? "ON" : "OFF"',
        },
        role: 'switch',
        type: 'boolean',
        read: true,
        write: true,
        name: `${stateIdToPurpose(stateId)} Power`,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            ...lovelaceConfig(stateId, 'Power'),
          },
        },
      },
    };

    acc[device] = {
      type: 'device',
      native: {},
      common: { name: stateIdToPurpose(stateId), role: 'device' },
      enumIds: ObjectCreator.getEnumIds(stateId, 'rooms', 'functions'),
      nested: Object.entries(deviceStates).reduce((acc, [id, common]) => {
        acc[id] = { type: 'state', native: {}, common: common };
        return acc;
      }, {} as ObjectDefinitionRoot),
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

export {};
await ObjectCreator.create(getObjectDefinition(), 'alias.0');

stopScript(undefined);
