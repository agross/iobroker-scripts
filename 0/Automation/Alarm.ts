import { Observable, combineLatest } from 'rxjs';
import {
  share,
  tap,
  withLatestFrom,
  filter,
  map,
  startWith,
  distinctUntilChanged,
} from 'rxjs/operators';

const alarmEnabled = ['0_userdata.0', 'alarm-enabled'];
const hmPresence = 'hm-rega.0.950';
const presenceIndicators = ['ping.0.iobroker.172_16_0_15'];
const triggerAlarmOn = ['zigbee.1.00158d00045bedc5.opened'];

await ObjectCreator.create(
  {
    [alarmEnabled[1]]: {
      type: 'state',
      common: {
        name: 'Alarm enabled',
        type: 'boolean',
        def: false,
        read: true,
        write: true,
        role: 'state',
        custom: {
          'lovelace.0': {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id('Alarm enabled'),
          },
        },
      } as StateCommonExt,
      native: {},
    },
  },
  alarmEnabled[0],
);

const presenceIndicatorChanges = presenceIndicators.map(indicator => {
  return new Observable<boolean>(observer => {
    on({ id: indicator, change: 'ne' }, event => {
      const present = event.state.val === true;

      observer.next(present);
    });
  }).pipe(startWith(getState(indicator).val === true), share());
});

const presence = combineLatest(presenceIndicatorChanges)
  .pipe(
    map(flags => flags.some(f => f)),
    distinctUntilChanged(),
    tap(present => log(`Presence indication: ${present}`)),
    tap(present => {
      const delayByMinutes = present ? 0 : 5;

      setStateDelayed(hmPresence, present, delayByMinutes * 60 * 1000, true);
      setStateDelayed(
        alarmEnabled.join('.'),
        !present,
        true,
        delayByMinutes * 60 * 1000,
        true,
      );
    }),
  )
  .subscribe();

const alarmEnabledChanges = new Observable<boolean>(observer => {
  on({ id: alarmEnabled.join('.'), change: 'ne' }, event => {
    observer.next(event.state.val);
  });
}).pipe(
  startWith(getState(alarmEnabled.join('.')).val),
  share(),
  distinctUntilChanged(),
);

const alarmTriggers = new Observable<string>(observer => {
  on({ id: triggerAlarmOn, val: true, change: 'ne' }, event => {
    const deviceId = event.id.replace(/\.[^.]*$/, '');
    const device = getObject(deviceId);

    observer.next(device.common.name);
  });
}).pipe(share());

const alarmEnabledNotifications = alarmEnabledChanges
  .pipe(
    tap(enabled => {
      const message = `Alarm ${enabled ? 'enabled' : 'disabled'}`;

      Notify.mobile(message);
    }),
  )
  .subscribe();

const alarmNotifications = alarmTriggers
  .pipe(
    withLatestFrom(alarmEnabledChanges),
    filter(([_device, enabled]) => enabled),
    map(([device, _enabled]) => device),
    map(device => `Alarm triggered by ${device}`),
    tap(message => {
      Notify.mobile(message, 'warn');
    }),
  )
  .subscribe();

onStop(() => {
  [presence, alarmEnabledNotifications, alarmNotifications].forEach(x =>
    x.unsubscribe(),
  );
});
