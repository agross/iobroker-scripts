import { Observable } from 'rxjs';
import {
  share,
  tap,
  withLatestFrom,
  filter,
  map,
  startWith,
  distinctUntilChanged,
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

const alarmEnabledChanges = new Observable<boolean>(observer => {
  on({ id: config.alarmEnabled.join('.'), change: 'ne' }, event => {
    observer.next(event.state.val);
  });
}).pipe(
  startWith(getState(config.alarmEnabled.join('.')).val),
  share(),
  distinctUntilChanged(),
);

const alarmTriggers = new Observable<string>(observer => {
  on({ id: config.triggerAlarmOn, val: true, change: 'ne' }, event => {
    const deviceId = event.id.replace(/\.[^.]*$/, '');
    const device = getObject(deviceId);

    observer.next(device.common.name);
  });
}).pipe(share());

const alarmEnabledNotifications = alarmEnabledChanges
  .pipe(
    tap(enabled => {
      const message = `${Site.location}: Alarm ${
        enabled ? 'enabled' : 'disabled'
      }`;

      Notify.mobile(message);
    }),
  )
  .subscribe();

const alarmNotifications = alarmTriggers
  .pipe(
    withLatestFrom(alarmEnabledChanges),
    filter(([_device, enabled]) => enabled),
    map(([device, _enabled]) => device),
    map(device => `${Site.location}: Alarm triggered by ${device}`),
    tap(message => {
      Notify.mobile(message, 'warn');
    }),
  )
  .subscribe();

onStop(() => {
  [
    presenceForAlarmAndHeating,
    alarmEnabledNotifications,
    alarmNotifications,
  ].forEach(x => x.unsubscribe());
});
