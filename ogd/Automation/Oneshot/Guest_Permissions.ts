import util from 'util';

const config = {
  dryRun: false,
};

const permissions = [
  ...zigbeeLights(),
  ...scenes(),
  ...shutters(),
  ...powerPlugs(),
  ...custom(),
].map(async stateId => {
  const expect: Partial<iobJS.StateACL> = { state: 0x666 };

  await setPermissions(stateId, expect);
});

const translateCommonNames = [
  ...autodetectedDevices(),
  ...statesWithLovelaceConfig(),
].map(async deviceOrStateId => {
  log(`Translating common.name for ${deviceOrStateId}`);
  await copyCommonNameToSmartNameWithGermanTranslation(deviceOrStateId);
});

const translateCustomLovelaceConfig = [...statesWithLovelaceConfig()].map(
  async stateId => {
    log(`Translating custom Lovelace config for ${stateId}`);

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
  objectId: string,
  expected: Partial<iobJS.StateACL>,
) {
  const object = await getObjectAsync(objectId);
  const aclShrunkDownToExpected = Utils.shrink(object.acl, expected);

  if (
    aclShrunkDownToExpected &&
    util.isDeepStrictEqual(
      JSON.parse(JSON.stringify(expected)),
      JSON.parse(JSON.stringify(aclShrunkDownToExpected)),
    )
  ) {
    return;
  }

  const hexPermissions = function (name: string, val: any) {
    if (name === 'state') {
      return `0x${val.toString(16)}`;
    }

    return val;
  };

  log(
    `${objectId}: expected ${JSON.stringify(
      expected,
      hexPermissions,
      2,
    )} but got ${JSON.stringify(aclShrunkDownToExpected, hexPermissions, 2)}`,
    'warn',
  );

  if (config.dryRun) {
    return;
  }

  await extendObjectAsync(objectId, {
    acl: expected,
  });
}

function zigbeeLights() {
  return [
    ...$('state[id=zigbee.*.state](functions=light)'),
    ...$('state[id=zigbee.*.brightness](functions=light)'),
    ...$('state[id=zigbee.*.color](functions=light)'),
    ...$('state[id=zigbee.*.colortemp](functions=light)'),
    ...$('state[id=zigbee.*.gradient_scene](functions=light)'),
    ...$('state[id=alias.*.zigbee.*.*.random_gradient_scene]'),
  ];
}

function scenes() {
  return [...$('state[role=scene.state]')].filter(
    x => !x.includes('scene.0.Leaving'),
  );
}

function powerPlugs() {
  const allowed = [
    ...$('state[id=mqtt.*.*.*.power.cmnd.*.POWER]'),
    ...$('state[id=alias.*.mqtt.*.*.*.*.nous-a1t-*.*][role=switch]'),
  ].filter(x => !/nous-a1t-(1|3|4)/.test(x));

  log(`Allowed power plugs: ${JSON.stringify(allowed)}`);

  return allowed;
}

function shutters() {
  return [
    ...$('state[id=mqtt.*.*.*.shutter.cmnd.*.ShutterPosition1]'),
    ...$('state[id=alias.*.mqtt.*.*.*.shutter.shelly25-*.*]'),
  ].filter(x => !x.endsWith('.device_temperature'));
}

function custom() {
  return [...$('state[id=0_userdata.0.Brightness.*]')];
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
  deviceOrObjectId: string,
) {
  if (!(await existsObjectAsync(deviceOrObjectId))) {
    log(`Object ${deviceOrObjectId} does not exist`, 'warn');
    return;
  }

  const object = await getObjectAsync(deviceOrObjectId);

  if (!object?.common?.name) {
    log(`Object ${deviceOrObjectId} does not have a common.name`, 'warn');
    return;
  }

  const german = translate(object.common.name);
  if (german === object.common.name) {
    log(
      `No translation for ${deviceOrObjectId}.common.name: "${object.common.name}"`,
      'warn',
    );
    return;
  }

  if (config.dryRun) {
    return;
  }

  object.common.smartName = {
    de: german,
  };

  await setObjectAsync(deviceOrObjectId, object as any);
}

function translate(str: string) {
  if (!str) {
    return undefined;
  }

  // Translations are checked in order.
  const translations = {
    'All Lights On': 'Alle Lichter an',
    'All Lights Off': 'Alle Lichter aus',
    Brightness: 'Helligkeit',
    Global: 'Globale',

    'Reset Coffee Counter': 'Kaffeebezüge zurücksetzen',
    'Coffee Counter': 'Kaffeebezüge',

    Random: 'zufälliger',
    'Gradient Scene': 'Gradient',

    Refrigerator: 'Kühlschrank',
    'Water Heater': 'Boiler',
    Heater: 'Heizung',
    'Power Usage': 'Leistung',
    ' Power': '',

    'Next Shutter State Due Date': 'Geplante Behanghöhe',
    'Next Shutter State': 'Geplante Behanghöhe',

    'Kitchen Table': 'Küchentisch',
    'Living Room Table Top': 'Wohnzimmertisch nach oben',
    'Living Room Table Bottom': 'Wohnzimmertisch nach unten',
    'Living Room': 'Wohnzimmer',
    Bathroom: 'Bad',
    Kitchen: 'Küche',
    Staircase: 'Treppenaufgang',
    Bedroom: 'Schlafzimmer',
    Workshop: 'Werkstatt',
    'Equipment Room': 'Lager',
    Outside: 'Außen',
    Patio: 'Terrasse',
    Hall: 'Flur',
    'House Entrance': 'Hauseingang',
    House: 'Haus',
    Porch: 'Vordach',

    East: 'Ost',
    North: 'Nord',
    South: 'Süd',

    Illuminance: 'Lichtstärke',
    Temperature: 'Temperatur',
    Humidity: 'Luftfeuchtigkeit',
    Motion: 'Bewegung',
    Occupancy: 'Anwesenheit',
    Pressure: 'Luftdruck',
    'Smoke Detected': 'Rauchmelder',
    'Alarm Enabled': 'Alarm aktiv',
    'Table Light': 'Tisch',
    'Ceiling Light': 'Deckenlicht',
    Lights: 'Licht',
    'Light Strips Cozy': 'Light Strips gemütlich',
    'Light Strip': 'Light Strip',
    Light: 'Licht',
    Door: 'Tür',
    Shutters: 'Rollladen',
    'Level of Shutters': 'Behanghöhe',
    Roof: 'Dachschräge',

    Only: '',
    Off: 'aus',
    All: 'Alle',
    No: 'Ohne',

    Bright: 'Hell',
    Colorful: 'Farbig',
    Cozy: 'Gemütlich',
    Default: 'Normal',
    Dim: 'Abgedunkelt',
    Night: 'Sehr abgedunkelt',
    Presence: 'Anwesenheit',

    'Short-Term': 'Kurzzeit',
    'Long-Term Absence': 'Langzeit-Abwesenheit',
    'Long-Term': 'Langzeit',
    Returning: 'Rückkehr',
    'Highest Day Temperature': 'Tageshöchsttemperatur',
    Day: 'Tag',
    'Sunny Day': 'Sonniger Tag',
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
  objectId: string,
) {
  const [sourceInstance, ...targetInstances] = lovelaceInstances();

  if (targetInstances.length < 1) {
    log(`No target instances for config of ${sourceInstance}`, 'warn');
    return;
  }

  if (!(await existsObjectAsync(objectId))) {
    log(`Object ${objectId} does not exist`, 'warn');
    return;
  }

  const state = await getObjectAsync(objectId);
  const template = state.common.custom?.[sourceInstance];

  if (!template) {
    log(`${objectId} does not have ${sourceInstance} Lovelace config`, 'warn');

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

  await setObjectAsync(objectId, state as any);
}

async function copyLovelaceLayout() {
  const [sourceInstance, ...targetInstances] = lovelaceInstances();

  if (targetInstances.length < 1) {
    log(`No target instances for layout of ${sourceInstance}`, 'warn');
    return;
  }

  const configuration = await getObjectAsync(`${sourceInstance}.configuration`);
  const views = configuration.native.views;

  views.forEach(view => {
    const viewCards = view.cards as any[];
    viewCards.forEach(viewCard => {
      if (!viewCard.cards) {
        return;
      }

      const cards = viewCard.cards as any[];
      cards.forEach(card => {
        if (!card.title) {
          return;
        }

        log(`Translating Lovelace card title ${card.title}`);
        card.title = translate(card.title);
      });
    });
  });

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
