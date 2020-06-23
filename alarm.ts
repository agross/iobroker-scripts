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

const nobodyAtHome = 'nobody-at-home';
const presenceIndicators = ['ping.0.iobroker.172_16_0_15'];
const triggerAlarmOn = ['zigbee.0.00158d00045bedc5.opened'];

createState(nobodyAtHome, undefined, {
  name: 'Flag indicating that nobody is home',
  type: 'boolean',
  role: 'indicator.state',
});

function notify(message: string): void {
  sendTo('pushbullet', {
    message: message,
    title: 'ioBroker',
    type: 'note',
  });
}

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

      setStateDelayed(nobodyAtHome, !present, delayByMinutes * 60 * 1000, true);
    }),
  )
  .subscribe();

const alarmEnabledChanges = new Observable<boolean>(observer => {
  on({ id: nobodyAtHome, change: 'ne' }, event => {
    observer.next(event.state.val);
  });
}).pipe(startWith(getState(nobodyAtHome).val), share(), distinctUntilChanged());

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

      log(message);
      notify(message);
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
      log(message, 'warn');
      notify(message);
    }),
  )
  .subscribe();

onStop(() => {
  [presence, alarmEnabledNotifications, alarmNotifications].forEach(x =>
    x.unsubscribe(),
  );
});
