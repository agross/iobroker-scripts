import { combineLatest, Observable } from 'rxjs';
import {
  distinctUntilChanged,
  share,
  tap,
  filter,
  map,
  withLatestFrom,
} from 'rxjs/operators';

const config = {
  alarmEnabled: ['0_userdata.0', 'alarm-enabled'],
  presence: '0_userdata.0.presence',
  homematicPresence: AlarmConfig.homematicPresence,
  triggerAlarmOn: AlarmConfig.triggerAlarmOn,
};

await ObjectCreator.create(
  {
    [config.alarmEnabled[1]]: {
      type: 'state',
      common: {
        name: 'Alarm Enabled',
        type: 'boolean',
        def: false,
        read: true,
        write: true,
        role: 'state',
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id('Alarm Enabled'),
            attr_icon: 'mdi:lock',
          },
        },
      } as iobJS.StateCommon,
      native: {},
    },
  },
  config.alarmEnabled[0],
);

const alarmEnabledId = config.alarmEnabled.join('.');

const acknowledgeCommand = new Stream<boolean>({
  id: alarmEnabledId,
  ack: false,
}).stream
  .pipe(
    tap(x => log(`Acknowledging command: ${alarmEnabledId} = ${x}`)),
    tap(x => setState(alarmEnabledId, x, true)),
  )
  .subscribe();

const presenceForAlarmAndHeating = new Stream<boolean>(config.presence).stream
  .pipe(
    tap(present => {
      const delayByMinutes = present ? 0 : 5;
      const delay = delayByMinutes * 60 * 1000;

      log(
        `Setting alarm=${!present} and HomeMatic presence=${present} in ${delayByMinutes} min`,
      );

      if (config.homematicPresence) {
        setStateDelayed(config.homematicPresence, present, delay, true, err => {
          if (err) {
            log(
              `Could not set HomeMatic presence to ${present}: ${err}`,
              'error',
            );
          } else {
            log(`Set HomeMatic presence to ${present}`);
          }
        });
      }

      setStateDelayed(
        config.alarmEnabled.join('.'),
        !present,
        true,
        delay,
        true,
        err => {
          if (err) {
            log(`Could not set alarm to ${!present}: ${err}`, 'error');
          } else {
            log(`Set alarm to ${!present}`);
          }
        },
      );
    }),
  )
  .subscribe();

const alarmEnabled = new Stream<boolean>(config.alarmEnabled.join('.')).stream;

const alarmEnabledNotifications = alarmEnabled
  .pipe(
    tap(enabled => {
      const message = `Alarm ${enabled ? 'enabled' : 'disabled'}`;

      Notify.mobile(message);
    }),
  )
  .subscribe();

const alarmTriggers = new Observable<string[]>(observer => {
  log(`Monitoring alarm trigger: ${config.triggerAlarmOn.join(', ')}`);

  on({ id: config.triggerAlarmOn, val: true, change: 'ne' }, event => {
    const deviceName = Device.deviceName(event.id);

    log(`Potential alarm triggered by ${deviceName}`);
    observer.next([deviceName, event.id]);
  });
}).pipe(
  filter(([deviceName, id]) => {
    const allowed = AlarmConfig.allowDeviceAlarm(id);
    if (!allowed) {
      log(`Disallowing alarm trigger by ${deviceName}`, 'warn');
    }

    return allowed;
  }),
  map(([deviceName, _]) => deviceName),
  share(),
);

const alarmNotifications = alarmTriggers
  .pipe(
    withLatestFrom(alarmEnabled),
    filter(([_device, enabled]) => enabled),
    map(([device, _enabled]) => device),
    map(device => `Alarm triggered by ${device}`),
    tap(message => {
      Notify.mobile(message, { severity: 'warn' });
    }),
  )
  .subscribe();

const smokeAlarm = combineLatest(
  [...$('state[id=zigbee.*.smoke]')].map(id => {
    const deviceName = Device.deviceName(id);

    log(`Monitoring smoke alarm for ${deviceName}`);

    return new Stream(id, {
      map: event => {
        return {
          smokeDetected: event.state.val as boolean,
          deviceName: deviceName,
        };
      },
    }).stream;
  }),
)
  .pipe(
    map(x => x.filter(detector => detector.smokeDetected !== false)),
    filter(x => x.length > 0),
    map(x => x.map(detector => detector.deviceName)),
    map(devices => devices.sort().join(', ')),
    distinctUntilChanged(),
    tap(x => {
      Notify.mobile(`Smoke detected for ${x}`);
    }),
  )
  .subscribe();

onStop(() => {
  [
    acknowledgeCommand,
    presenceForAlarmAndHeating,
    alarmEnabledNotifications,
    alarmNotifications,
    smokeAlarm,
  ].forEach(x => x.unsubscribe());
});
