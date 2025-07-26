export {};
function defaultTransitionTime(deviceId) {
  if (
    // Bathroom.
    deviceId === 'zigbee.0.001788010e377c5a' ||
    // Utility room.
    deviceId === 'zigbee.0.680ae2fffea72a25'
  ) {
    return 0;
  }

  if (
    // Hall.
    deviceId === 'zigbee.0.00178801085708f3' ||
    // Staircase.
    deviceId === 'zigbee.0.001788010b418e9a'
  ) {
    return 1;
  }

  return 2;
}

const powerOnBehavior = $(
  'state[id=zigbee.*.power_on_behavior](functions=light)',
);

await powerOnBehavior.setStateAsync('off');

// https://www.zigbee2mqtt.io/devices/8718696449691.html#power-on-behavior
[...powerOnBehavior]
  .map(state => `${Device.id(state)}.send_payload`)
  .forEach(state =>
    setState(
      state,
      JSON.stringify({
        hue_power_on_behavior: 'off',
      }),
    ),
  );

$('state[id=zigbee.*.transition_time](functions=light)').each(
  async transitionTime => {
    const deviceId = Device.id(transitionTime);

    const expected = defaultTransitionTime(deviceId);
    const current = await getStateAsync(transitionTime);

    if (!current || current.val !== expected) {
      log(
        `Setting ${transitionTime} (${Device.deviceName(transitionTime)}) to ${expected}`,
      );
      await setStateAsync(transitionTime, expected);
    }
  },
);

stopScript(undefined);
