const devices = [...$('state[id=zigbee.*.irrigation_interval]')].map(x => ({
  id: Device.id(x),
  name: Device.deviceName(x),
}));

// { "cyclic_timed_irrigation": { "total_number": 1, "irrigation_duration": 60 } }
type Command = {
  cyclic_timed_irrigation: {
    total_number: number;
    irrigation_duration: number;
  };
};

function isKnownCommand(maybeCommand: object): maybeCommand is Command {
  return (
    'cyclic_timed_irrigation' in maybeCommand &&
    'total_number' in (<Command>maybeCommand).cyclic_timed_irrigation &&
    Number.isFinite(
      (<Command>maybeCommand).cyclic_timed_irrigation.total_number,
    )
  );
}

devices.forEach(async device => {
  log(`Subscribing to ${device.name} commands`);

  const payload = `${device.id}.send_payload`;
  const valveState = `${device.id}.state`;
  let timer: NodeJS.Timeout | undefined;

  on({ id: payload, ack: true }, event => {
    const command = JSON.parse(event.state.val);

    if (isKnownCommand(command)) {
      const timeoutInSeconds =
        command.cyclic_timed_irrigation.irrigation_duration;
      log(`${device.name}'s valve is shut off in ${timeoutInSeconds} seconds`);

      clearTimeout(timer);
      setState(valveState, true, true);

      timer = setTimeout(() => {
        log(`Shutting off ${device.name} valve state`);

        setState(valveState, false, true);
      }, timeoutInSeconds * 1000);
    }
  });
});
