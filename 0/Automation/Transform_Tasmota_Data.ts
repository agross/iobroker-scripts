on(
  {
    id: /^mqtt\..*\.tele\.gosund-sp111-\d+\.SENSOR$/,
    change: 'ne',
    ack: true,
  },
  event => {
    const json = JSON.parse(event.newState.val);
    const power = json.ENERGY.Power as number;

    log(`${event.id}: ${power} W`, 'debug');

    const id = `transformed-${event.id}.Power`;
    if (getState(id).notExist) {
      createState(id, power, true, { unit: 'W' });
    } else {
      setState(id, power, true);
    }
  },
);

function toBool(val: string): boolean {
  if (val === 'ON') {
    return true;
  }

  return false;
}

on(
  { id: /^mqtt\..*\.tele\.gosund-sp111-\d+\.STATE$/, change: 'ne', ack: true },
  event => {
    const json = JSON.parse(event.newState.val);
    const power = json.POWER as string;
    const powerAsBool = toBool(power);

    log(`${event.id}: Power ${power} -> ${powerAsBool}`, 'debug');

    const id = 'transformed-' + event.id + '.State';
    if (getState(id).notExist) {
      createState(id, powerAsBool, true, { type: 'boolean' });
    } else {
      setState(id, powerAsBool, true);
    }
  },
);
