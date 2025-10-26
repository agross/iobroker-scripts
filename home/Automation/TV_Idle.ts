import { interval, Observable, of, concat, combineLatest, merge } from 'rxjs';
import {
  distinctUntilChanged,
  tap,
  map,
  timestamp,
  debounceTime,
  withLatestFrom,
  filter,
  scan,
  distinctUntilKeyChanged,
} from 'rxjs/operators';

const config = {
  activityIndicators: [
    function (): Observable<StateWithId> {
      // Kodi's playing time while TV input is HDMI 1.

      const input = new Stream<string>('lgtv.0.states.input').stream;

      const playingTime = new Stream<StateWithId>(
        {
          id: 'kodi.0.info.playing_time',
          ack: true,
        },
        {
          map: event => ({
            id: event.id,
            state: event.state,
          }),
        },
      ).stream;

      return combineLatest([input, playingTime]).pipe(
        filter(([input, _time]) => input === 'HDMI_1'),
        map(([_input, time]) => time),
      );
    },
    'lgtv.0.states.channelId',
    'lgtv.0.states.currentApp',
    'lgtv.0.states.volume',
  ],
  tvDevice: 'lgtv.0',
  whitelistedLgApps: [
    'airplay',
    'amazon',
    'ard.mediathek',
    'de.zdf.app.zdfm3',
    'netflix',
    'spotify-beehive',
    'tagesschau',
    'youtube.leanback.v4',
  ],
  turnOffAfter: 20,
  timeoutPopups: [10, 5, 1],
  debugSpeedUp: 1, // 30,
};

function minutesToMs(val: number): number {
  return (val * 60 * 1000) / config.debugSpeedUp;
}

type StateWithId = Pick<iobJS.ChangedStateObject<any, any>, 'id' | 'state'>;

interface DisabledReason {
  disabled: boolean;
  reason: string;
}

class WhitelistedApp {
  private device: string;
  private apps: string[];
  private _stream: Observable<DisabledReason>;

  constructor(device: string, ...apps: string[]) {
    this.device = device;
    this.apps = apps;

    this._stream = new Stream<DisabledReason>(this.stateId, {
      map: event => this.isWhitelisted(event.state.val),
    }).stream.pipe(distinctUntilKeyChanged('disabled'));
  }

  private isWhitelisted(app: string): DisabledReason {
    if (this.apps.indexOf(app) !== -1) {
      log(`Whitelisted LG app ${app} active`);
      return { disabled: true, reason: `app ${app}` };
    }

    if (app.length > 0) {
      log(`LG app ${app} active`);
    }

    return { disabled: false, reason: '' };
  }

  private get stateId(): string {
    return `${this.device}.states.currentApp`;
  }

  public get stream(): Observable<DisabledReason> {
    return this._stream;
  }
}

class TV {
  private device: string;
  private _stream: Observable<boolean>;

  constructor(device: string) {
    this.device = device;

    this._stream = new Stream<boolean>(`${this.device}.states.on`).stream.pipe(
      debounceTime(10000),
      distinctUntilChanged(),
    );
  }

  public get stream(): Observable<boolean> {
    return this._stream;
  }

  public message(message: string): void {
    Notify.tv(message);
  }

  public turnOff(): void {
    setState(`${this.device}.states.power`, false, false);
  }
}

class ActivityIndicator {
  private ids: (string | (() => Observable<StateWithId>))[];
  private _stream: Observable<StateWithId>;

  constructor(...ids: (string | (() => Observable<StateWithId>))[]) {
    this.ids = ids;

    this._stream = merge(
      ...this.stateBasedActivityIndicators,
      ...this.customActivityIndicators,
    ).pipe(
      distinctUntilChanged(
        (previous, current) => previous >= current,
        x => x.state.lc,
      ),
    );
  }

  public get stream(): Observable<StateWithId> {
    return this._stream;
  }

  private get stateBasedActivityIndicators(): Observable<StateWithId>[] {
    return this.ids
      .filter(id => typeof id === 'string')
      .map(id => id.toString())
      .map(
        indicator =>
          new Stream<StateWithId>(indicator, {
            map: event => ({
              id: event.id,
              state: event.state,
            }),
          }).stream,
      );
  }

  private get customActivityIndicators(): Observable<StateWithId>[] {
    return this.ids
      .filter(id => typeof id === 'function')
      .map((factory: () => Observable<StateWithId>) => factory());
  }
}

const tv = new TV(config.tvDevice);

const tvLog = tv.stream.pipe(tap(x => log(`TV on: ${x}`))).subscribe();

const timerDisabled: Observable<DisabledReason> = combineLatest([
  new WhitelistedApp(config.tvDevice, ...config.whitelistedLgApps).stream,
]).pipe(
  map(flags => {
    return {
      disabled: flags.some(f => f.disabled),
      reason: flags
        .filter(f => f.disabled)
        .map(f => f.reason)
        .join(', '),
    };
  }),
  distinctUntilKeyChanged('disabled'),
);

const timerDisabledNotifications = timerDisabled
  .pipe(
    tap(x => {
      if (x.disabled) {
        tv.message(`TV Idle disabled b/c ${x.reason}`);
      } else {
        tv.message('TV Idle enabled');
      }
    }),
  )
  .subscribe();

const activity = new ActivityIndicator(...config.activityIndicators).stream;

function throttleDistinct<T>(
  duration: number,
  equals: (a: T, b: T) => boolean = (a, b) => a === b,
) {
  return (source: Observable<T>) => {
    return source.pipe(
      map(x => {
        const obj = { val: x, time: Date.now(), keep: true };
        return obj;
      }),
      scan((acc, cur) => {
        const diff = cur.time - acc.time;

        const isSame = equals(acc.val, cur.val);
        return diff > duration || (diff < duration && !isSame)
          ? { ...cur, keep: true }
          : { ...acc, keep: false };
      }),
      filter(x => x.keep),
      map(x => x.val),
    );
  };
}

const activityLog = activity
  .pipe(
    withLatestFrom(tv.stream),
    filter(([_state, tvOn]) => tvOn),
    map(([state, _tvOn]) => state.id),
    throttleDistinct(60 * 1000),
    tap(x => log(`Activity: ${x}`)),
  )
  .subscribe();

const timeoutNotifications = config.timeoutPopups.map(left => {
  return activity
    .pipe(
      debounceTime(minutesToMs(config.turnOffAfter - left)),
      withLatestFrom(timerDisabled),
      filter(([_state, disabled]) => !disabled.disabled),
      withLatestFrom(tv.stream),
      filter(([_state, tvOn]) => tvOn),
      map(([state, _tvOn]) => state),
      tap(_ => log(`Time left: ${left}`)),
      tap(_ => {
        const message = `Turning off in ${left} minute${left > 1 ? 's' : ''}`;

        tv.message(message);
      }),
    )
    .subscribe();
});

const turnOff = activity
  .pipe(
    debounceTime(minutesToMs(config.turnOffAfter)),
    withLatestFrom(timerDisabled),
    filter(([_state, disabled]) => !disabled.disabled),
    withLatestFrom(tv.stream),
    filter(([_state, tvOn]) => tvOn),
    map(([state, _tvOn]) => state),
    tap(() => log('Turning off TV')),
    tap(_ => tv.turnOff()),
  )
  .subscribe();

onStop(() => {
  tv.message(`TV Idle disabled`);

  [timerDisabledNotifications, turnOff, tvLog, activityLog]
    .concat(timeoutNotifications)
    .forEach(subscription => subscription.unsubscribe());
});
