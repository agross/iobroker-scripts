const config = {
  override: ['0_userdata.0', 'global-brightness-override'],
  state: () => config.override.join('.'),
  excludedScenes: [
    'artic_aurora',
    'autumn_gold',
    'beginnings',
    'blood_moon',
    'blossom',
    'blue_lagoon',
    'blue_planet',
    'city_of_love',
    'crocus',
    'crystalline',
    'emerald_flutter',
    'emerald_isle',
    'first_light',
    'frosty_dawn',
    'forest_adventure',
    'hal',
    'honolulu',
    'horizon',
    'lake_mist',
    'lake_placid',
    'magneto',
    'memento',
    'midsummer_sun',
    'midwinter',
    'moonlight',
    'motown',
    'mountain_breeze',
    'narcissa',
    'nebula',
    'ocean_dawn',
    'palm_beach',
    'precious',
    'promise',
    'runy_glow',
    'silent_night',
    'soho',
    'spring_blossom',
    'spring_lake',
    'starlight',
    'sunday_morning',
    'sundown',
    'sunflare',
    'under_the_tree',
    'valley_dawn',
    'vapor_wave',
    'winter_beauty',
    'winter_mountain',
  ],
};

function getObjectDefinition() {
  return [...$('state[id=zigbee.*.gradient_scene]')].reduce((acc, stateId) => {
    const device = Device.id(stateId);

    const sceneStates: {} = getObject(stateId).common.states || [];
    const scenes = Object.keys(sceneStates).filter(
      x => !config.excludedScenes.includes(x),
    );

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
