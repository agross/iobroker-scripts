const adapter = 'ecovacs-deebot.*';

const deebots = [
  ...new Set(
    [...$(`channel[id=${adapter}][state.id=*.status.device]`)].map(x =>
      x.replace(/^([\w-]+\.\d+)\..*/, '$1'),
    ),
  ),
]
  .map(root => {
    return {
      root: root,
      name: getState(`${root}.info.deviceModel`).val,
    };
  })
  .reduce((acc, deebot) => {
    const spotAreas = [
      ...$(`state[id=${deebot.root}.control.spotArea_*][role=button]`),
    ]
      .map(spotAreaId => ({
        spotAreaId: spotAreaId,
        schedulerId: spotAreaId.replace(/_\d+$/, ''),
        object: getObject(spotAreaId),
      }))
      .filter(spotArea => spotArea.object.common.name.length > 1)
      .reduce((acc, spotArea) => {
        const areaName = spotArea.object.common.name;

        acc[areaName] = {
          type: 'state',
          common: {
            name: areaName,
            role: 'state',
            type: 'boolean',
            read: true,
            write: true,
            def: false,
            custom: {
              ['lovelace.0']: {
                enabled: true,
                entity: 'switch',
                name: Lovelace.id(`Schedule Clean ${areaName}`),
                attr_device_class: 'switch',
                attr_icon: 'mdi:broom',
                attr_friendly_name: `Schedule ${areaName}`,
              },
            },
          },
          native: {
            sourcedFrom: spotArea.spotAreaId,
            schedulerId: spotArea.schedulerId,
            areaIndex: spotArea.spotAreaId.match(/spotArea_(\d)+$/)[1],
          },
        };

        return acc;
      }, {} as ObjectDefinitionRoot);

    acc[deebot.root] = {
      type: 'device',
      native: {},
      common: { name: deebot.name, role: 'device' },
      nested: {
        'Scheduled Spot Areas': {
          type: 'channel',
          common: { name: 'Spot areas scheduled to be cleaned' },
          native: {},
          nested: spotAreas,
        },
      },
    };

    return acc;
  }, {} as ObjectDefinitionRoot);

export {};
await ObjectCreator.create(deebots, '0_userdata.0');

const scheduledSpotAreas = [
  ...$(`state[id=0_userdata.0.${adapter}.Spot Areas.*]`),
]
  .map(x => {
    return {
      state: x,
      value: getState(x).val,
    };
  })
  .filter(x => x.value === true)
  .map(x => {
    const native = getObject(x.state).native;

    return {
      ...x,
      ...{
        scheduleAreaIndex: native.areaIndex,
        scheduleId: native.schedulerId,
      },
    };
  });

var targets = scheduledSpotAreas.reduce((acc, schedule) => {
  if (!acc[schedule.scheduleId]) {
    acc[schedule.scheduleId] = [];
  }

  acc[schedule.scheduleId].push(schedule.scheduleAreaIndex);

  return acc;
}, {});

for (const target in targets) {
  const areaIds = targets[target].sort().join(',');

  console.log(`Scheduling ${target} with areas ${areaIds}`);
  await setStateAsync(target, areaIds);
}

await Promise.all(
  scheduledSpotAreas.map(async x => {
    log(`Resetting schedule of ${x.state}`);
    return await setStateAsync(x.state, false, true);
  }),
);

stopScript(undefined);
