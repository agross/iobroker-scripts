import { tap } from 'rxjs/operators';

const adapter = 'vw-connect.0.';

function getAliasDefinition(
  cars: { root: string; name: string }[],
): ObjectDefinitionRoot {
  return cars.reduce((acc, car) => {
    function state(common: StateCommonExt): ObjectDefinition {
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
      enumIds: ['enum.rooms.fake', 'enum.functions.Security'],
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
    function state(common: StateCommonExt): ObjectDefinition {
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
      enumIds: ['enum.rooms.fake', 'enum.functions.Security'],
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

  const reasons = `^${escape(
    car.root,
  )}\\.history\\.dwaPushHistory\\..*\\.dwaAlarmReasonClustered$`;

  log(`Subscribing to ${reasons}`);

  return new Stream<{ id: string; reason: string }>(
    {
      id: new RegExp(reasons),
    },
    event => {
      return { id: event.id, reason: event.state.val };
    },
  ).stream
    .pipe(
      tap(x => Notify.mobile(`${car.name} alarm: ${x.reason}`)),
      tap(x => {
        const entry = x.id.replace(/\.dwaAlarmReasonClustered$/, '');
        const acked = getState(entry + '.fnsAcknowledged').val === true;

        const reason = acked ? '' : x.reason;
        const ts = acked ? null : getState(entry + '.vehicleUtcTimestamp').val;

        setState('0_userdata.0.' + car.root + '.Alarm.reason', reason);
        setState('0_userdata.0.' + car.root + '.Alarm.timestamp', ts);
      }),
    )
    .subscribe();
});

onStop(() => alarms.forEach(a => a.unsubscribe()));
