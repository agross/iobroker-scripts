const config = {
  override: ['0_userdata.0', 'global-brightness-override'],
  state: () => config.override.join('.'),
  remote: 'hm-rpc.1.000B5A49A07F8D',
  change: 5,
};

function getObjectDefinition() {
  return [...$('state[id=zigbee.*.gradient_scene]')].reduce((acc, stateId) => {
    const device = Device.id(stateId);

    const sceneStates: string = getObject(stateId).common.states || [];
    const scenes = sceneStates.split(';').map(x => x.replace(/:.*/, ''));

    const deviceStates: {
      [id: string]: iobJS.StateCommon;
    } = {
      random_gradient_scene: {
        alias: {
          id: stateId,
          read: 'false',
          write: `${JSON.stringify(scenes)}[Math.floor(Math.random() * ${
            scenes.length
          })];`,
        },
        role: 'switch',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Random Gradient Scene',
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(
              `${Device.deviceName(stateId)} Random Gradient Scene`,
            ),
            attr_device_class: 'switch',
            attr_icon: 'mdi:gradient-vertical',
            attr_friendly_name: `${Device.deviceName(
              stateId,
            )} Random Gradient Scene`,
          },
        },
      },
    };

    acc[device] = {
      type: 'device',
      native: {},
      common: { name: Device.deviceName(stateId), role: 'device' },
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
