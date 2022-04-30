import util from 'util';

const config = {
  dryRun: false,
};

var permissions = [...zigbeeLights(), ...scenes(), ...custom()].map(
  async stateId => {
    const expect: Partial<iobJS.StateACL> = { state: 1638 };

    await setPermissions(stateId, expect);
  },
);

var lovelace = [...statesWithLovelaceConfig()].map(async stateId => {
  await copyLovelaceConfigFromFirstToOtherInstances(stateId);
});

await Promise.all([permissions, lovelace]);

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

async function copyLovelaceConfigFromFirstToOtherInstances(stateId: string) {
  const instances = [...$('state[id=system.adapter.lovelace.*.alive]')].map(
    alive => alive.replace(/^system\.adapter\./, '').replace(/\.alive$/, ''),
  );

  if (instances.length <= 1) {
    return;
  }

  const state = await getObjectAsync(stateId);

  const template = state.common.custom[instances[0]];

  if (!template) {
    log(`${stateId} should have Lovelace config but does not`, 'warn');
    return;
  }

  template.attr_friendly_name = translate(template.attr_friendly_name);

  instances.slice(1).forEach(instance => {
    state.common.custom[instance] = template;
  });

  if (config.dryRun) {
    return;
  }

  await extendObjectAsync(stateId, {
    common: state.common,
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
    Outside: 'Draußen',

    East: 'Ost',
    'South Roof': 'Süd',
    'North Roof': 'Nord',
    Middle: 'Mitte',

    Temperature: 'Temperatur',
    Humidity: 'Luftfeuchtigkeit',
    'Table Light': 'Tischlampe',
    'Ceiling Light': 'Deckenlicht',
    Light: 'Licht',

    On: 'an',
    Off: 'aus',
    Open: 'geöffnet',
  };

  let loop = 0;
  let index = 0;
  let result = str;

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

function statesWithLovelaceConfig() {
  return [...$('state')].filter(stateId => {
    return getAttr(getObject(stateId), ['common', 'custom', 'lovelace.0']);
  });
}

stopScript(undefined);
