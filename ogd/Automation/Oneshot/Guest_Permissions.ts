import util from 'util';

const config = {
  dryRun: false,
};

async function check(stateId: string, expected: Partial<iobJS.StateACL>) {
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

var promises = [...zigbeeLights(), ...scenes()].map(async stateId => {
  const expect: Partial<iobJS.StateACL> = { state: 1638 };

  await check(stateId, expect);
});

await Promise.all(promises);

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

stopScript(undefined);
