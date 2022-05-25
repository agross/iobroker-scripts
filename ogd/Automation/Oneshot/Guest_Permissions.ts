import util from 'util';

const config = {
  dryRun: false,
};

const permissions = [...zigbeeLights(), ...scenes(), ...custom()].map(
  async stateId => {
    const expect: Partial<iobJS.StateACL> = { state: 1638 };

    await setPermissions(stateId, expect);
  },
);

const translateCommonNames = [
  ...autodetectedDevices(),
  ...statesWithLovelaceConfig(),
].map(async deviceOrStateId => {
  log(deviceOrStateId);
  await copyCommonNameToSmartNameWithGermanTranslation(deviceOrStateId);
});

const translateCustomLovelaceConfig = [...statesWithLovelaceConfig()].map(
  async stateId => {
    await copyCustomLovelaceConfigWithGermanTranslationOfExplicitFriendlyName(
      stateId,
    );
  },
);

const lovelaceLayout = copyLovelaceLayout();

await Promise.all([
  permissions,
  translateCommonNames,
  translateCustomLovelaceConfig,
  lovelaceLayout,
]);

async function setPermissions(
  stateId: string,
  expected: Partial<iobJS.StateACL>,
) {
  const state = await getObjectAsync(stateId);
  const aclShrunkDownToExpected = Utils.shrink(state.acl, expected);

  if (
    aclShrunkDownToExpected &&
    util.isDeepStrictEqual(
      JSON.parse(JSON.stringify(expected)),
      JSON.parse(JSON.stringify(aclShrunkDownToExpected)),
    )
  ) {
    return;
  }

  log(
    `${stateId}: expected ${JSON.stringify(
      expected,
      null,
      2,
    )} but got ${JSON.stringify(aclShrunkDownToExpected, null, 2)}`,
    'warn',
  );

  if (config.dryRun) {
    return;
  }

  await extendObjectAsync(stateId, {
    acl: expected,
  });
}

function zigbeeLights() {
  return [
    ...$('state[id=zigbee.*.state](functions=light)'),
    ...$('state[id=zigbee.*.brightness](functions=light)'),
    ...$('state[id=zigbee.*.color](functions=light)'),
    ...$('state[id=zigbee.*.colortemp](functions=light)'),
  ];
}

function scenes() {
  return [...$('state[role=scene.state]')];
}

function custom() {
  return ['0_userdata.0.global-brightness-override'];
}

function autodetectedDevices() {
  return [
    ...$('state[id=zigbee.*.state](functions=light)'),
    'alias.0.mqtt.0.ogd.living-room.shutter.shelly25-1',
  ].map(x => x.replace(/\.state$/, ''));
}

function statesWithLovelaceConfig() {
  return [...$('state')].filter(stateId => {
    if (!existsObject(stateId)) {
      return false;
    }

    const object = getObject(stateId);
    if (!object) {
      return false;
    }

    return getAttr(object, ['common', 'custom', AdapterIds.lovelace]);
  });
}

async function copyCommonNameToSmartNameWithGermanTranslation(
  deviceOrStateId: string,
) {
  if (!(await existsObjectAsync(deviceOrStateId))) {
    log(`Object ${deviceOrStateId} does not exist`, 'warn');
    return;
  }

  const object = await getObjectAsync(deviceOrStateId);

  if (!object?.common?.name) {
    log(`Object ${deviceOrStateId} does not have a common.name`, 'warn');
    return;
  }

  const german = translate(object.common.name);
  if (german === object.common.name) {
    log(
      `No translation for ${deviceOrStateId}.common.name: "${object.common.name}"`,
      'warn',
    );
    return;
  }

  object.common.smartName = {
    de: german,
  };

  if (config.dryRun) {
    return;
  }

  await extendObjectAsync(deviceOrStateId, {
    common: object.common,
  });
}

function translate(str: string) {
  if (!str) {
    return undefined;
  }

  // Translations are checked in order.
  const translations = {
    'Kitchen Table Light': 'Küchentisch Licht',
    'Kitchen Counter Light': 'Küchenzeile Licht',
    'Living Room': 'Wohnzimmer',
    Bathroom: 'Bad',
    Kitchen: 'Küche',
    Staircase: 'Treppenaufgang',
    Bedroom: 'Schlafzimmer',
    Workshop: 'Werkstatt',
    'Equipment Room': 'Lager',
    Outdoor: 'Draußen',
    Patio: 'Terrasse',
    Hall: 'Flur',
    Entrance: 'Eingang',

    East: 'Ost',
    'South Roof': 'Süd',
    'North Roof': 'Nord',
    Middle: 'Mitte',

    Illumination: 'Lichtstärke',
    Temperature: 'Temperatur',
    Humidity: 'Luftfeuchtigkeit',
    Motion: 'Bewegung',
    Occupancy: 'Anwesenheit',
    'Table Light': 'Tischlampe',
    'Ceiling Light': 'Deckenlicht',
    Lights: 'Licht',
    'Light Switch': 'Lichtschalter',
    Light: 'Licht',
    Door: 'Tür',
    Shutters: 'Rollladen',

    Only: '',
    All: 'Alle',
    Off: 'aus',
    On: 'an',

    Bright: 'hell',
    Cozy: 'gemütlich',
    'Global Brightness Override': 'Globale Helligkeit',
    Presence: 'Präsenz',
  };

  let loop = 0;
  let index = 0;
  let result = str.slice(0);

  while (index < result.length) {
    if (loop++ > 100) {
      log(`Loop detected while translating '${str}'`, 'error');
      return str;
    }

    const found = Object.keys(translations).find(k =>
      result.startsWith(k, index),
    );

    if (found) {
      const processed = result.substring(0, index);
      const replacement = translations[found];
      const rest = result.substring(processed.length + found.length);

      result = `${processed}${replacement}${rest}`;
      index += replacement.length;

      log(
        `Replace: '${processed}' '${replacement}' '${rest}', new index ${index}, new result '${result}'`,
        'debug',
      );
    } else {
      index += 1;

      log(
        `Nothing found for '${result.substring(
          index,
        )}', new index ${index}, new result '${result}'`,
        'debug',
      );

      if (index >= result.length) {
        return result;
      }
    }
  }

  return result;
}

function lovelaceInstances() {
  return [...$('state[id=system.adapter.lovelace.*.alive]')].map(alive =>
    alive.replace(/^system\.adapter\./, '').replace(/\.alive$/, ''),
  );
}

async function copyCustomLovelaceConfigWithGermanTranslationOfExplicitFriendlyName(
  stateId: string,
) {
  const [sourceInstance, ...targetInstances] = lovelaceInstances();

  if (targetInstances.length < 1) {
    log(`No target instances for config of ${sourceInstance}`, 'warn');
    return;
  }

  if (!(await existsObjectAsync(stateId))) {
    log(`Object ${stateId} does not exist`, 'warn');
    return;
  }

  const state = await getObjectAsync(stateId);
  const template = state.common.custom?.[sourceInstance];

  if (!template) {
    log(`${stateId} does not have ${sourceInstance} Lovelace config`, 'warn');

    return;
  }

  const lovelace = Object.assign({}, template);
  lovelace.attr_friendly_name = translate(lovelace.attr_friendly_name);

  targetInstances.forEach(instance => {
    state.common.custom ||= {};
    state.common.custom[instance] = lovelace;
  });

  if (config.dryRun) {
    return;
  }

  await extendObjectAsync(stateId, {
    common: state.common,
  });
}

async function copyLovelaceLayout() {
  const [sourceInstance, ...targetInstances] = lovelaceInstances();

  if (targetInstances.length < 1) {
    log(`No target instances for layout of ${sourceInstance}`, 'warn');
    return;
  }

  const configuration = await getObjectAsync(`${sourceInstance}.configuration`);
  const views = configuration.native.views;

  if (config.dryRun) {
    return;
  }

  return targetInstances.map(async instance => {
    const configuration = `${instance}.configuration`;

    await extendObjectAsync(configuration, { native: { views: null } });
    await extendObjectAsync(configuration, { native: { views: views } });
  });
}

stopScript(undefined);
