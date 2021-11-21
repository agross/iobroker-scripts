function getObjectDefinition(): ObjectDefinitionRoot {
  function deviceId(id: string): string {
    return id.replace(/\.[^.]*$/, '').replace(/\.(cmnd|tele|stat)\./, '.');
  }

  function stateIdToPurpose(stateId: string) {
    switch (stateId.match(/\.gosund-sp111-(\d+)\./)[1]) {
      case '1':
        return 'Living Room Media';

      case '2':
        return 'Kitchen Down Light';

      case '3':
        return 'Bathroom Washing Machine';

      case '4':
        return 'Office Desk';

      default:
        throw new Error(`No mapping from ${stateId} to purpose`);
    }
  }

  return [...$('state[id=*.cmnd.gosund-sp111-*.POWER]')].reduce(
    (acc, stateId) => {
      const device = deviceId(stateId);

      const lovelaceEntityType = ObjectCreator.getEnumIds(
        stateId,
        'functions',
      ).includes('enum.functions.light')
        ? 'light'
        : 'switch';

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
              entity: lovelaceEntityType,
              name: Lovelace.id(`${stateIdToPurpose(stateId)} Power`),
              attr_device_class: 'outlet',
              attr_icon: 'mdi:power-socket-eu',
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
    },
    {} as ObjectDefinitionRoot,
  );
}

export {};
await ObjectCreator.create(getObjectDefinition(), 'alias.0');

stopScript(undefined);
