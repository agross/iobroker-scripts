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

function statesWithLovelaceConfig() {
  return [...$('state')].filter(stateId => {
    return getAttr(getObject(stateId), ['common', 'custom', 'lovelace.0']);
  });
}

stopScript(undefined);
