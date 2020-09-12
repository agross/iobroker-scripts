function alias(id: string): string {
  return (
    'alias.0.' + id.replace(/\.[^.]*$/, '').replace(/\.(cmnd|tele|stat)\./, '.')
  );
}

function getEnumIds(id: string, kind: string): string[] {
  return (getObject(id, kind) as any).enumIds;
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

const enumsToDeviceAliases: { [enumId: string]: string[] } = {};

$('state[id=*.cmnd.gosund-sp111-*.POWER]').each(stateId => {
  const lovelaceEntityType = getEnumIds(stateId, 'functions').includes(
    'enum.functions.funcLight',
  )
    ? 'light'
    : 'switch';

  const aliases: { [state: string]: any } = {
    power: {
      alias: {
        id: stateId.replace('.cmnd.', '.tele.').replace(/\.POWER$/, '.SENSOR'),
        read: 'JSON.parse(val).ENERGY.Power',
        // No write function makes this read-only.
      },
      role: 'value',
      type: 'number',
      unit: 'W',
      read: true,
      write: false,
      name: `${stateIdToPurpose(stateId)} power usage`,
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
      name: `${stateIdToPurpose(stateId)} power state`,
      custom: {
        'lovelace.0': {
          enabled: true,
          entity: lovelaceEntityType,
          name: `${stateIdToPurpose(stateId).replace(/\s/g, '_')}_Power`,
        },
      },
    },
  };

  const deviceAlias = alias(stateId);

  const skeleton: iobJS.StateObject = {
    type: 'state',
    native: {},
    common: {} as iobJS.StateCommon,
  };

  const channel: iobJS.Object = {
    type: 'channel',
    native: {},
    common: { name: stateIdToPurpose(stateId), role: 'device' },
  };

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

    setObject(`${deviceAlias}.${state}`, dup, err => {
      if (err)
        log(
          `${err}: ${deviceAlias}.${state}: ${JSON.stringify(
            dup,
            undefined,
            2,
          )}`,
          'error',
        );
    });
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

stopScript(undefined);
