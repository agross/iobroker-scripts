import { filter, tap } from 'rxjs/operators';

const config = {
  visits: ['0_userdata.0', 'nighttime-bathroom-visits'],
  locations: {
    east: {
      switch: 'zigbee.0.50325ffffe71dbf1.state',
      scene: 'scene.0.Bedroom East.Nighttime_Bathroom_Visit',
      bedroomLights: 'scene.0.Bedroom East.Lights',
    },
    west: {
      switch: 'zigbee.0.50325ffffe6b9dac.state',
      scene: 'scene.0.Bedroom West.Nighttime_Bathroom_Visit',
      bedroomLights: 'scene.0.Bedroom West.Lights',
    },
  },
};

await ObjectCreator.create(
  {
    [config.visits[1]]: {
      type: 'state',
      common: {
        name: 'Active Nighttime Bathroom Visits',
        type: 'array',
        def: JSON.stringify([]),
        read: true,
        write: true,
        role: 'state',
      } as iobJS.StateCommon,
      native: {},
    },
  },
  config.visits[0],
);

function getVisits(): [string, Set<string>] {
  const visits = config.visits.join('.');
  try {
    const active = getState(visits).val || [];
    return [visits, new Set<string>(active)];
  } catch {
    log('Could not load visits, returning empty set', 'warn');
    return [visits, new Set<string>()];
  }
}

function addVisit(name) {
  const [visits, active] = getVisits();
  active.add(name);

  setState(visits, [...active], true);
}

function removeVisit(name): [boolean, string[]] {
  const [visits, active] = getVisits();
  const deleted = active.delete(name);

  setState(visits, [...active], true);

  return [deleted, [...active]];
}

const locations = Object.entries(config.locations).map(([name, location]) => {
  const button = new Stream<boolean>(
    {
      id: location.switch,
      ack: true,
    },
    { pipe: obs => obs },
  ).stream;

  const on = button.pipe(
    filter(x => x === true),
    tap(_ => {
      log(`Bathroom visit started: ${name}`);
      setState(location.scene, true);

      addVisit(name);
    }),
  );

  const off = button.pipe(
    filter(x => x === false),
    tap(_ => {
      log(`Bathroom visit ended: ${name}`);

      // Turn of our bedroom lights, keep the lights on the way to the bathroom
      // on.
      setState(location.bedroomLights, false);

      // If we were the last visit that ended, turn off lights on the way.
      const [removed, remaining] = removeVisit(name);
      if (removed && remaining.length === 0) {
        log(`Last bathroom visit ended by ${name}`);
        setState(location.scene, false);
      }
    }),
  );

  return [on, off];
});

const subscriptions = locations
  .reduce((acc, curr) => {
    return [...acc, ...curr];
  }, [])
  .map(x => x.subscribe());

onStop(() => {
  subscriptions.forEach(subscription => subscription.unsubscribe());
});
