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
].map(async (stateId: string) => {
  const expect: Partial<iobJS.StateACL> = { state: 0x666 };

  await setPermissions(stateId, expect);

  const maybeAlias = getObject(stateId);
  const target =
    maybeAlias.common?.alias?.id?.write || maybeAlias.common?.alias?.id;

  if (target) {
    await setPermissions(target, expect);
  }
});
await Promise.all(permissions);

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
  return [...$('state[role=scene.state]')];
}

function powerPlugs() {
  const allowed = [
    ...$('state[id=alias.*.mqtt.*.*.*.*.gosund-sp111-*.*][role=switch]'),
  ].filter(x => /gosund-sp111-(1|2|3)\./.test(x));

  log(`Allowed power plugs: ${JSON.stringify(allowed)}`);
  return allowed;
}

function shutters() {
  return [
    ...$('state[id=alias.*.hm-rpc.*.*.close]'),
    ...$('state[id=alias.*.hm-rpc.*.*.open]'),
    ...$('state[id=alias.*.hm-rpc.*.*.stop]'),
    ...$('state[id=alias.*.hm-rpc.*.*.tilt_close]'),
    ...$('state[id=alias.*.hm-rpc.*.*.tilt_level]'),
    ...$('state[id=alias.*.hm-rpc.*.*.tilt_open]'),
  ];
}

function custom() {
  return [...$('state[id=0_userdata.0.Brightness.*]')];
}

stopScript(undefined);
