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
                id: `${car.root}.status.maintenanceStatus.oilServiceDue_km`,
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
                id: `${car.root}.status.maintenanceStatus.oilServiceDue_days`,
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
                id: `${car.root}.status.maintenanceStatus.inspectionDue_km`,
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
                id: `${car.root}.status.maintenanceStatus.inspectionDue_days`,
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
        Position: {
          type: 'channel',
          common: { name: 'Position' },
          native: {},
          nested: {
            latitude: state({
              alias: {
                id: `${car.root}.parkingposition.lat`,
              },
              role: 'value.gps.latitude',
              type: 'number',
              read: true,
              write: false,
              name: 'GPS latitude',
            }),
            longitude: state({
              alias: {
                id: `${car.root}.parkingposition.lon`,
              },
              role: 'value.gps.longitude',
              type: 'number',
              read: true,
              write: false,
              name: 'GPS longitude',
            }),
            geohash: state({
              alias: {
                id: `${car.root}.position.geohash`,
              },
              role: 'indicator',
              type: 'string',
              read: true,
              write: false,
              name: 'Geohash',
            }),
            'is-moving': state({
              alias: {
                id: `${car.root}.position.isMoving`,
              },
              role: 'indicator',
              type: 'boolean',
              read: true,
              write: false,
              name: 'Is the vehicle moving',
            }),
          },
        },
        States: {
          type: 'channel',
          common: { name: 'States' },
          native: {},
          nested: {
            locked: state({
              alias: {
                id: `${car.root}.status.accessStatus.doorLockStatus`,
                read: "val === 'locked'",
              },
              role: 'indicator',
              type: 'boolean',
              read: true,
              write: false,
              name: 'Car Locked',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'binary_sensor',
                  name: Lovelace.id('Car locked'),
                  attr_icon: 'mdi:lock',
                },
              },
            }),
            lock: state({
              alias: {
                id: {
                  read: `${car.root}.status.isCarLocked`,
                  write: `${car.root}.remote.access`,
                },
              },
              role: 'switch',
              type: 'boolean',
              read: true,
              write: true,
              name: 'Lock or Unlock Car',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'switch',
                  name: Lovelace.id('Car lock'),
                  attr_icon: 'mdi:lock',
                },
              },
            }),
            temperature: state({
              alias: {
                // TODO: Currently no data point.
                id: `${car.root}.status.temperatureOutsideStatus`,
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
                // TODO: Currently no data point.
                id: `${car.root}.status.accessStatus.overallStatus`,
                read: "val === 'safe'",
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
                id: `${car.root}.status.maintenanceStatus.mileage_km`,
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
                id: `${car.root}.status.measurements_rangeStatus.adBlueRange`,
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
                id: `${car.root}.status.rangeStatus.totalRange_km`,
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
                id: `${car.root}.status.rangeStatus.primaryEngine.currentFuelLevel_pct`,
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
                // TODO: Currently no data point.
                id: `${car.root}.status.oilLevelStatus`,
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
        Alarm: {
          type: 'channel',
          common: { name: 'Unacknowledged Alarm' },
          native: {},
          nested: {
            reason: state({
              role: 'indicator',
              type: 'string',
              read: true,
              write: false,
              name: 'Reason',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car alarm reason'),
                },
              },
            }),
            timestamp: state({
              role: 'indicator',
              type: 'mixed',
              read: true,
              write: false,
              name: 'Alarm Timestamp',
              custom: {
                [AdapterIds.lovelace]: {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car alarm timestamp'),
                  attr_device_class: 'timestamp',
                },
              },
            }),
          },
        },
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
          },
        },
      },
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

const cars = [
  ...new Set(
    [...$(`channel[id=${adapter}*][role=indicator]`)].map(
      x => adapter + x.substring(adapter.length).replace(/\..*/, ''),
    ),
  ),
].map(root => {
  return {
    root: root,
    name: getState(`${root}.general.model`).val,
  };
});

await ObjectCreator.create(getAliasDefinition(cars), 'alias.0');
await ObjectCreator.create(getUserDataDefinition(cars), '0_userdata.0');

const parkedWithWindowOpen = cars.map(car => {
  const windowMap = {
    'front-left': 'frontLeft',
    'rear-left': 'rearLeft',
    'front-right': 'frontRight',
    'rear-right': 'rearRight',
  };

  const windowStates = Object.entries(windowMap).map(([k, v]) => {
    const state = `${car.root}.status.accessStatus.windows.${v}.status.closed`;

    log(`Subscribing to ${k} window: ${state}`);

    return new Stream<string>(state).stream.pipe(
      map(e => {
        return {
          window: k,
          open: e !== 'closed',
        };
      }),
      distinctUntilKeyChanged('open'),
    );
  });

  const openWindows = combineLatest(windowStates).pipe(
    map(windows => windows.filter(window => window.open)),
    distinctUntilChanged((x, y) => util.isDeepStrictEqual(x, y)),
  );

  const windowsOpenState = `0_userdata.0.${car.root}.States.windows-open`;
  const windowsClosedState = `0_userdata.0.${car.root}.States.windows-closed`;

  const windowUserStates = openWindows.pipe(
    tap(windows => log(`Open windows: ${windows.map(w => w.window).join()}`)),
    tap(windows => {
      const closed = windows.length === 0;

      setState(windowsOpenState, !closed, true);
      setState(windowsClosedState, closed, true);
    }),
  );

  const locked = new Stream<boolean>(
    `alias.0.${car.root}.States.locked`,
  ).stream.pipe(distinctUntilChanged());
  const parkingBreakEngaged = new Stream<boolean>(
    `alias.0.${car.root}.States.parking-brake-engaged`,
  ).stream.pipe(distinctUntilChanged());

  const parkedWithWindowOpen = combineLatest([
    openWindows,
    locked,
    parkingBreakEngaged,
  ]).pipe(
    filter(
      ([openWindows, locked, parked]) =>
        openWindows.length > 0 && locked && parked,
    ),
    tap(_ => Notify.mobile('Car is parked and locked with window open!')),
  );

  return [windowUserStates.subscribe(), parkedWithWindowOpen.subscribe()];
});

const parkedAtHomeUnlocked = cars.map(car => {
  const atHome = new Stream<boolean>('0_userdata.0.presence').stream.pipe(
    distinctUntilChanged(),
  );

  const locked = new Stream<boolean>(
    `alias.0.${car.root}.States.locked`,
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
  []
    .concat(...parkedWithWindowOpen, ...parkedAtHomeUnlocked, ...tightenTyres)
    .forEach(s => s.unsubscribe()),
);
