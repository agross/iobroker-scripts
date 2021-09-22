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
            ['oil-distance']: state({
              alias: {
                id: `${car.root}.status.data_0x0203FFFFFF.field_0x0203010001.value`,
                read: 'val * -1',
              },
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: false,
              name: 'Distance to oil change',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car distance to oil change'),
                },
              },
            }),
            ['oil-time']: state({
              alias: {
                id: `${car.root}.status.data_0x0203FFFFFF.field_0x0203010002.value`,
                read: 'val * -1',
              },
              role: 'indicator',
              type: 'number',
              unit: 'd',
              read: true,
              write: false,
              name: 'Time to oil change',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car time to oil change'),
                },
              },
            }),
            ['inspection-distance']: state({
              alias: {
                id: `${car.root}.status.data_0x0203FFFFFF.field_0x0203010003.value`,
                read: 'val * -1',
              },
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: false,
              name: 'Distance to inspection',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car distance to inspection'),
                },
              },
            }),
            ['inspection-time']: state({
              alias: {
                id: `${car.root}.status.data_0x0203FFFFFF.field_0x0203010004.value`,
                read: 'val * -1',
              },
              role: 'indicator',
              type: 'number',
              unit: 'd',
              read: true,
              write: false,
              name: 'Time to inspection',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car time to inspection'),
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
                id: `${car.root}.position.latitudeConv`,
              },
              role: 'value.gps.latitude',
              type: 'number',
              read: true,
              write: false,
              name: 'GPS latitude',
            }),
            longitude: state({
              alias: {
                id: `${car.root}.position.longitudeConv`,
              },
              role: 'value.gps.longitude',
              type: 'number',
              read: true,
              write: false,
              name: 'GPS longitude',
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
                id: `${car.root}.status.isCarLocked`,
              },
              role: 'indicator',
              type: 'boolean',
              read: true,
              write: false,
              name: 'Car locked',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'binary_sensor',
                  name: Lovelace.id('Car locked'),
                },
              },
            }),
            lock: state({
              alias: {
                id: {
                  read: `${car.root}.status.isCarLocked`,
                  write: `${car.root}.remote.lockv2`,
                },
              },
              role: 'switch',
              type: 'boolean',
              read: true,
              write: true,
              name: 'Lock or unlock car',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'switch',
                  name: Lovelace.id('Car lock'),
                },
              },
            }),
            temperature: state({
              alias: {
                id: `${car.root}.status.outsideTemperature`,
              },
              role: 'value.temperature',
              type: 'number',
              unit: '°C',
              read: true,
              write: false,
              name: 'Outside temperature',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car outside temperature'),
                  attr_device_class: 'temperature',
                  attr_unit_of_measurement: '°C',
                },
              },
            }),
            ['parking-brake-engaged']: state({
              alias: {
                id: `${car.root}.status.data_0x0301FFFFFF.field_0x0301030001.value`,
              },
              role: 'indicator',
              type: 'boolean',
              read: true,
              write: false,
              name: 'Parking brake engaged',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'binary_sensor',
                  name: Lovelace.id('Car parking brake engaged'),
                },
              },
            }),
            mileage: state({
              alias: {
                id: `${car.root}.status.data_0x0101010002.field_0x0101010002.value`,
                read: 'val == 4294967295 ? null : val',
              },
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: false,
              name: 'Mileage',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car mileage'),
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
            ['adblue-range']: state({
              alias: {
                id: `${car.root}.status.data_0x0204FFFFFF.field_0x02040C0001.value`,
              },
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: false,
              name: 'Remaining AdBlue range',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car remaining AdBlue range'),
                },
              },
            }),
            ['fuel-range']: state({
              alias: {
                id: `${car.root}.status.data_0x0301FFFFFF.field_0x0301030006.value`,
              },
              role: 'indicator',
              type: 'number',
              unit: 'km',
              read: true,
              write: false,
              name: 'Remaining fuel range',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car remaining fuel range'),
                },
              },
            }),
            ['fuel-level']: state({
              alias: {
                id: `${car.root}.status.data_0x0301FFFFFF.field_0x030103000A.value`,
              },
              role: 'indicator',
              type: 'number',
              unit: '%',
              read: true,
              write: false,
              name: 'Fuel level',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car fuel level'),
                  attr_device_class: 'humidity',
                  attr_unit_of_measurement: '%',
                },
              },
            }),
            ['oil-level']: state({
              alias: {
                id: `${car.root}.status.data_0x0204FFFFFF.field_0x0204040003.value`,
              },
              role: 'indicator',
              type: 'number',
              unit: '%',
              read: true,
              write: false,
              name: 'Oil level',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car oil level'),
                  attr_device_class: 'humidity',
                  attr_unit_of_measurement: '%',
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
                'lovelace.0': {
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
              name: 'Alarm timestamp',
              custom: {
                'lovelace.0': {
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
              name: 'Tyre change',
              custom: {
                'lovelace.0': {
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
              name: 'Tighten tyres at mileage',
              custom: {
                'lovelace.0': {
                  enabled: true,
                  entity: 'sensor',
                  name: Lovelace.id('Car tighten tyres at mileage'),
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
              name: 'Windows open',
              custom: {
                'lovelace.0': {
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
              name: 'Windows closed',
              custom: {
                'lovelace.0': {
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
      x => adapter + x.substr(adapter.length).replace(/\..*/, ''),
    ),
  ),
].map(root => {
  return {
    root: root,
    name: getState(`${root}.general.carportData.modelName`).val,
  };
});

await ObjectCreator.create(getAliasDefinition(cars), 'alias.0');
await ObjectCreator.create(getUserDataDefinition(cars), '0_userdata.0');

const alarms = cars.map(car => {
  function escape(string: string) {
    // $& means the whole matched string.
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const reasons = `^${escape(car.root)}\\.history\\.dwaPushHistory\\..*\\.id$`;

  log(`Subscribing to alarms ${reasons}`);

  return new Stream<{
    id: string;
    reason: string;
    acknowledged: boolean;
    timestamp: Date;
  }>(
    {
      id: new RegExp(reasons),
    },
    event => {
      const entry = event.id.replace(/\.\w+$/, '');
      const reason = getState(entry + '.dwaAlarmReasonClustered').val;
      const ack = getState(entry + '.fnsAcknowledged').val === true;
      const ts = new Date(getState(entry + '.vehicleUtcTimestamp').val);

      return {
        id: event.state.val,
        reason: reason,
        acknowledged: ack,
        timestamp: ts,
      };
    },
  ).stream
    .pipe(
      distinctUntilChanged((x, y) => util.isDeepStrictEqual(x, y)),
      tap(x =>
        Notify.mobile(
          `${x.acknowledged ? 'Acknowledged ' : ''}${
            car.name
          } alarm from ${x.timestamp.toLocaleString()}: ${x.reason} (ID: ${
            x.id
          })`,
        ),
      ),
      tap(x => {
        const reason = x.acknowledged ? '' : x.reason;
        const ts = x.acknowledged ? null : x.timestamp.toLocaleString();

        setState('0_userdata.0.' + car.root + '.Alarm.reason', reason, true);
        setState('0_userdata.0.' + car.root + '.Alarm.timestamp', ts, true);
      }),
    )
    .subscribe();
});

const parkedWithWindowOpen = cars.map(car => {
  const windowMap = {
    'front-left': 'field_0x0301050001',
    'rear-left': 'field_0x0301050003',
    'front-right': 'field_0x0301050005',
    'rear-right': 'field_0x0301050007',
  };

  const windowStates = Object.entries(windowMap).map(([k, v]) => {
    const state = `${car.root}.status.data_0x0301FFFFFF.${v}.value`;

    log(`Subscribing to ${k} window: ${state}`);

    return new Stream<number>(state).stream.pipe(
      filter(e => e == 2 || e == 3),
      map(e => {
        return {
          window: k,
          open: e == 2,
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
    .concat(
      alarms,
      ...parkedWithWindowOpen,
      ...parkedAtHomeUnlocked,
      ...tightenTyres,
    )
    .forEach(s => s.unsubscribe()),
);
