$('state[id=zigbee.*.available](functions=light)').each(id => {
  const match = id.match(/^(zigbee\.\d+)\.([^.]+)\.available$/);

  const instance = match[1];
  const device = match[2];

  const name = getObject(`${instance}.${device}`).common.name;

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
});

stopScript(undefined);
