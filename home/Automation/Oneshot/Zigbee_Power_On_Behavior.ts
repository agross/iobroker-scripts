const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const setPowerOnBehavior = [
  ...$('state[id=zigbee.*.available](functions=light)'),
].map(id => {
  const match = id.match(/^(zigbee\.\d+)\.([^.]+)\.available$/);

  const instance = match[1];
  const device = match[2];

  const name = getObject(`${instance}.${device}`).common.name;

  return () => {
    sendTo(
      instance,
      'SendToDevice',
      {
        device: device,
        // https://www.zigbee2mqtt.io/devices/5062431P7.html#power-on-behavior
        payload: {
          hue_power_on_behavior: 'recover',
        },
      },
      result => {
        if (result.success) {
          log(`Configured ${instance}.${device} (${name})`, 'info');
        } else {
          log(
            `Error configuring ${instance}.${device} (${name}): ${JSON.stringify(
              result,
            )}`,
            'error',
          );
        }
      },
    );
  };
});

await setPowerOnBehavior.reduce(async (_, set) => {
  await _;
  set();
  log('Waiting...');
  await delay(2000);
}, Promise.resolve());

stopScript(undefined);
