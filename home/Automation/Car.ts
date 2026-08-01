import { combineLatest } from 'rxjs';
import {
  distinctUntilChanged,
  distinctUntilKeyChanged,
  filter,
  map,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import util from 'util';

const adapter = 'vw-connect.0.';

function getAliasDefinition(
  cars: { root: string; name: string }[],
): ObjectDefinitionRoot {
  return cars.reduce((acc, car) => {
    function state(common: iobJS.StateCommon): ObjectDefinition {
      return {
        type: 'state',
        common: common,
        native: {},
      };
    }

    acc[car.root] = {
      type: 'device',
      native: {},
      common: { name: car.name, role: 'device' },
      enumIds: ['enum.rooms.fake', 'enum.functions.security'],
      nested: {
        Maintenance: {
          type: 'channel',
          common: { name: 'Maintenance' },
          native: {},
          nested: {
            'oil-distance': state({
              alias: {
                id: `${car.root}.statuseudata.maintenance_interval_distance_until_oil_change`,
                read: 'val * -1',
              },
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: false,
              name: 'Distance to Oil Change',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car distance to oil change'),
                  attr_icon: 'mdi:map-marker-distance',
                },
              },
            }),
            'oil-time': state({
              alias: {
                id: `${car.root}.statuseudata.maintenance_interval__time_until_oil_change`,
                read: 'val * -1',
              },
              role: 'indicator',
              type: 'number',
              unit: 'd',
              read: true,
              write: false,
              name: 'Time to Oil Change',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car time to oil change'),
                  attr_icon: 'mdi:timer-sand',
                },
              },
            }),
            'inspection-distance': state({
              alias: {
                id: `${car.root}.statuseudata.maintenance_interval_distance_until_inspection`,
                read: 'val * -1',
              },
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: false,
              name: 'Distance to Inspection',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car distance to inspection'),
                  attr_icon: 'mdi:map-marker-distance',
                },
              },
            }),
            'inspection-time': state({
              alias: {
                id: `${car.root}.statuseudata.maintenance_interval__time_until_inspection`,
                read: 'val * -1',
              },
              role: 'indicator',
              type: 'number',
              unit: 'd',
              read: true,
              write: false,
              name: 'Time to Inspection',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car time to inspection'),
                  attr_icon: 'mdi:timer-sand',
                },
              },
            }),
          },
        },
        States: {
          type: 'channel',
          common: { name: 'States' },
          native: {},
          nested: {
            temperature: state({
              alias: {
                id: `${car.root}.statuseudata.outside_temperature`,
                read: '(val / 10 - 273.15).toFixed(1)',
              },
              role: 'value.temperature',
              type: 'number',
              unit: '°C',
              read: true,
              write: false,
              name: 'Outside Temperature',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car outside temperature'),
                  attr_device_class: 'temperature',
                  attr_unit_of_measurement: '°C',
                },
              },
            }),
            'parking-brake-engaged': state({
              alias: {
                id: `${car.root}.statuseudata.parking_brake`,
                read: 'val === 1',
              },
              role: 'indicator',
              type: 'boolean',
              read: true,
              write: false,
              name: 'Parking Brake Engaged',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'binary_sensor',
                  name: Lovelace.id('Car parking brake engaged'),
                  attr_icon: 'mdi:car-brake-parking',
                },
              },
            }),
            mileage: state({
              alias: {
                id: `${car.root}.statuseudata.mileage`,
                read: 'val >= 2147483647 ? null : val',
              },
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: false,
              name: 'Mileage',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car mileage'),
                  attr_icon: 'mdi:counter',
                },
              },
            }),
          },
        },
        Levels: {
          type: 'channel',
          common: { name: 'Levels' },
          native: {},
          nested: {
            'adblue-range': state({
              alias: {
                id: `${car.root}.statuseudata.scr_range`,
              },
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: false,
              name: 'Remaining AdBlue Range',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car remaining AdBlue range'),
                  attr_icon: 'mdi:radius-outline',
                },
              },
            }),
            'fuel-range': state({
              alias: {
                id: `${car.root}.statuseudata.cruising_range_primary_engine`,
              },
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: false,
              name: 'Remaining Fuel Range',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car remaining fuel range'),
                  attr_icon: 'mdi:radius-outline',
                },
              },
            }),
            'fuel-level': state({
              alias: {
                id: `${car.root}.statuseudata.fuel_level_current_level`,
              },
              role: 'indicator',
              type: 'number',
              unit: '%',
              read: true,
              write: false,
              name: 'Fuel Level',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car fuel level'),
                  attr_unit_of_measurement: '%',
                  attr_icon: 'mdi:fuel',
                },
              },
            }),
            'oil-level': state({
              alias: {
                id: `${car.root}.statuseudata.oil_level_actual_level`,
              },
              role: 'indicator',
              type: 'number',
              unit: '%',
              read: true,
              write: false,
              name: 'Oil Level',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car oil level'),
                  attr_unit_of_measurement: '%',
                  attr_icon: 'mdi:oil-level',
                },
              },
            }),
          },
        },
      },
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

function getUserDataDefinition(
  cars: { root: string; name: string }[],
): ObjectDefinitionRoot {
  return cars.reduce((acc, car) => {
    function state(common: iobJS.StateCommon): ObjectDefinition {
      return {
        type: 'state',
        common: common,
        native: {},
      };
    }

    acc[car.root] = {
      type: 'device',
      native: {},
      common: { name: car.name, role: 'device' },
      enumIds: ['enum.rooms.fake', 'enum.functions.security'],
      nested: {
        Maintenance: {
          type: 'channel',
          common: { name: 'Maintenance' },
          native: {},
          nested: {
            'tyre-change': state({
              role: 'state',
              type: 'boolean',
              read: true,
              write: true,
              name: 'Tyre Change',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'script',
                  name: Lovelace.id('Car tyre change'),
                },
              },
            }),
            'tighten-tyres-at-mileage': state({
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: true,
              name: 'Tighten Tyres at Mileage',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car tighten tyres at mileage'),
                  attr_icon: 'mdi:car-tire-alert',
                },
              },
            }),
          },
        },
        States: {
          type: 'channel',
          common: { name: 'States' },
          native: {},
          nested: {
            'windows-open': state({
              role: 'indicator.state',
              type: 'boolean',
              read: true,
              write: false,
              name: 'Windows Open',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'binary_sensor',
                  name: Lovelace.id('Car windows open'),
                  attr_device_class: 'window',
                },
              },
            }),
            'windows-closed': state({
              role: 'indicator.state',
              type: 'boolean',
              read: true,
              write: false,
              name: 'Windows Closed',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'binary_sensor',
                  name: Lovelace.id('Car windows closed'),
                  attr_device_class: 'window',
                },
              },
            }),
            unlocked: state({
              role: 'indicator.state',
              type: 'boolean',
              read: true,
              write: false,
              name: 'Unlocked',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'binary_sensor',
                  name: Lovelace.id('Car unlocked'),
                  attr_device_class: 'lock',
                  attr_icon: 'mdi:lock-open',
                },
              },
            }),
            locked: state({
              role: 'indicator.state',
              type: 'boolean',
              read: true,
              write: false,
              name: 'Locked',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'binary_sensor',
                  name: Lovelace.id('Car locked'),
                  attr_device_class: 'lock',
                  attr_icon: 'mdi:lock',
                },
              },
            }),
          },
        },
      },
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

const cars = [...$(`${adapter}*.general.nickname`)].map(nicknameState => ({
  root: nicknameState.replace('.general.nickname', ''),
  name: getState(nicknameState).val,
}));

await ObjectCreator.create(getAliasDefinition(cars), 'alias.0');
await ObjectCreator.create(getUserDataDefinition(cars), '0_userdata.0');

function windows(car: string) {
  const states = [...$(`${car}.statuseudata.position_*_window_lifter`)].map(
    state => {
      log(`Subscribing to window: ${state}`);

      return new Stream<number>(state).stream.pipe(
        map(e => ({
          window: state
            .replace(`${car}.statuseudata.position_`, '')
            .replace('_window_lifter', ''),
          open: e !== 0,
        })),
        distinctUntilKeyChanged('open'),
      );
    },
  );

  const openWindows = combineLatest(states).pipe(
    map(windows => windows.filter(window => window.open)),
    distinctUntilChanged((x, y) => util.isDeepStrictEqual(x, y)),
  );

  const userStates = openWindows.pipe(
    tap(windows => log(`Open windows: ${windows.map(w => w.window).join()}`)),
    tap(windows => {
      const closed = windows.length === 0;

      setState(`0_userdata.0.${car}.States.windows-open`, !closed, true);
      setState(`0_userdata.0.${car}.States.windows-closed`, closed, true);
    }),
  );

  return [openWindows, userStates];
}

function locks(car: string) {
  const states = [...$(`${car}.statuseudata.locked_state_*`)].map(state => {
    log(`Subscribing to lock: ${state}`);

    return new Stream<number>(state).stream.pipe(
      map(e => ({
        lock: state
          .replace(`${car}.statuseudata.locked_state_`, '')
          .replace(/^_*/, ''),
        open: e !== 2,
      })),
      distinctUntilKeyChanged('open'),
    );
  });

  const unlockedLocks = combineLatest(states).pipe(
    map(locks => locks.filter(lock => lock.open)),
    distinctUntilChanged((x, y) => util.isDeepStrictEqual(x, y)),
  );

  const userStates = unlockedLocks.pipe(
    tap(locks => log(`Unlocked locks: ${locks.map(l => l.lock).join()}`)),
    tap(locks => {
      const locked = locks.length === 0;

      setState(`0_userdata.0.${car}.States.unlocked`, !locked, true);
      setState(`0_userdata.0.${car}.States.locked`, locked, true);
    }),
  );

  return [unlockedLocks, userStates];
}

const parkedWithWindowOpen = cars.map(car => {
  const [openWindows, windowUserStates] = windows(car.root);
  const [unlockedLocks, lockUserStates] = locks(car.root);

  const parkingBreakEngaged = new Stream<boolean>(
    `alias.0.${car.root}.States.parking-brake-engaged`,
  ).stream.pipe(distinctUntilChanged());

  const parkedWithWindowOpen = combineLatest([
    openWindows,
    unlockedLocks,
    parkingBreakEngaged,
  ]).pipe(
    filter(
      ([openWindows, unlockedLocks, parked]) =>
        openWindows.length > 0 && unlockedLocks.length == 0 && parked,
    ),
    tap(_ => Notify.mobile('Car is parked and locked with window open!')),
  );

  return [
    windowUserStates.subscribe(),
    lockUserStates.subscribe(),
    parkedWithWindowOpen.subscribe(),
  ];
});

const parkedAtHomeUnlocked = cars.map(car => {
  const atHome = new Stream<boolean>('0_userdata.0.presence').stream.pipe(
    distinctUntilChanged(),
  );

  const locked = new Stream<boolean>(
    `0_userdata.0.${car.root}.States.locked`,
  ).stream.pipe(distinctUntilChanged());

  const parkingBreakEngaged = new Stream<boolean>(
    `alias.0.${car.root}.States.parking-brake-engaged`,
  ).stream.pipe(distinctUntilChanged());

  const parkedAtHome = combineLatest([
    atHome,
    locked,
    parkingBreakEngaged,
  ]).pipe(
    map(([atHome, locked, parked]) => atHome && !locked && parked),
    distinctUntilChanged((last, now) => last === false && now === true),
    filter(x => x === true),
    tap(_ => Notify.mobile('Car is parked at home and unlocked!')),
  );

  return [parkedAtHome.subscribe()];
});

const tightenTyres = cars.map(car => {
  const tyreChangeState = `0_userdata.0.${car.root}.Maintenance.tyre-change`;
  const tyreChange = new Stream<boolean>({ id: tyreChangeState }).stream;

  const tightenTyresState = `0_userdata.0.${car.root}.Maintenance.tighten-tyres-at-mileage`;
  const tightenTyres = new Stream<number>(tightenTyresState).stream;

  const mileage = new Stream<number>(`alias.0.${car.root}.States.mileage`)
    .stream;

  const setTightenMileage = tyreChange
    .pipe(
      filter(x => x === true),
      withLatestFrom(mileage),
      map(([_, mileage]) => mileage + 50),
      tap(tighten => setState(tightenTyresState, tighten, true)),
      tap(_ => setStateDelayed(tyreChangeState, false, true, 1000)),
      tap(tighten =>
        Notify.mobile(`You'll receive a notification at ${tighten} km!`),
      ),
    )
    .subscribe();

  const tightenNotification = mileage
    .pipe(
      withLatestFrom(tightenTyres),
      filter(([_, tighten]) => tighten > 0),
      filter(([mileage, tighten]) => mileage >= tighten),
      tap(([_, tighten]) =>
        Notify.mobile(
          `Tighten changed tyres now that ${tighten} km are reached!`,
        ),
      ),
      tap(_ => setState(tightenTyresState, 0, true)),
    )
    .subscribe();

  return [setTightenMileage, tightenNotification];
});

onStop(() =>
  parkedWithWindowOpen
    .flat()
    .concat(...parkedAtHomeUnlocked, ...tightenTyres)
    .forEach(s => s.unsubscribe()),
);
