import {
  interval,
  Observable,
  of,
  EMPTY,
  concat,
  combineLatest,
  merge,
} from 'rxjs';
import {
  share,
  distinctUntilChanged,
  tap,
  map,
  timestamp,
  debounceTime,
  withLatestFrom,
  filter,
  mapTo,
  throttle,
  scan,
} from 'rxjs/operators';

const activityIndicators = [
  function (): Observable<StateWithId> {
    // Kodi's playing time with TV input is HDMI 1.

    function input(): Observable<string> {
      const stateId = 'lgtv.0.states.input';

      const state = getState(stateId);
      const initialInput = state.notExist ? EMPTY : of(state.val as string);

      const inputChanges = new Observable<string>(observer => {
        on({ id: stateId, ack: true }, event => {
          observer.next(event.state.val);
        });
      }).pipe(share());

      return concat(initialInput, inputChanges);
    }

    const playingTime = new Observable<StateWithId>(observer => {
      on({ id: 'kodi.0.info.playing_time', ack: true }, event => {
        const state = {
          id: event.id,
          state: event.state,
        };

        observer.next(state);
      });
    }).pipe(share());

    const stream = combineLatest([input(), playingTime]).pipe(
      filter(([input, _time]) => input === 'HDMI_1' || input === '1'),
      map(([_input, time]) => time),
      share(),
    );

    return stream;
  },
  'lgtv.0.states.channelId',
  'lgtv.0.states.currentApp',
  'lgtv.0.states.volume',
];

const tvDevice = 'lgtv.0';
const whitelistedLgApps = [
  'airplay',
  'amazon',
  'ard.mediathek',
  'de.zdf.app.zdfm3',
  'netflix',
  'tagesschau',
  'youtube.leanback.v4',
];

const turnOffAfter = 20;
const timeoutPopups = [10, 5, 1];

const debugSpeedUp = 1; // 30;

function minutesToMs(val: number): number {
  return (val * 60 * 1000) / debugSpeedUp;
}

interface StateWithId {
  id: string;
  state: iobJS.State;
}

class WhitelistedApp {
  private device: string;
  private apps: string[];
  private _stream: Observable<boolean>;

  constructor(device: string, ...apps: string[]) {
    this.device = device;
    this.apps = apps;

    this._stream = concat(this.initialValue, this.changes).pipe(
      distinctUntilChanged(),
    );
  }

  private isWhitelisted(app: string): boolean {
    if (this.apps.indexOf(app) !== -1) {
      log(`Whitelisted LG app ${app} active`);
      return true;
    }

    if (app.length > 0) {
      log(`LG app ${app} active`);
    }

    return false;
  }

  private get stateId(): string {
    return `${this.device}.states.currentApp`;
  }

  private get initialValue(): Observable<boolean> {
    const current = getState(this.stateId);
    if (current.notExist) {
      return EMPTY;
    }

    return of(this.isWhitelisted(current.val));
  }

  private get changes(): Observable<boolean> {
    return new Observable<boolean>(observer => {
      on({ id: this.stateId, change: 'ne', ack: true }, event => {
        const whitelisted = this.isWhitelisted(event.state.val);

        observer.next(whitelisted);
      });
    }).pipe(share());
  }

  public get stream(): Observable<boolean> {
    return this._stream;
  }
}

class Tatort {
  public get stream(): Observable<boolean> {
    return concat(this.initialValue, this.changes).pipe(distinctUntilChanged());
  }

  private get initialValue(): Observable<boolean> {
    return of(this.isTatortTimeWindow(new Date()));
  }

  private get changes(): Observable<boolean> {
    return interval(minutesToMs(1)).pipe(
      timestamp(),
      map(val => {
        const now = new Date(val.timestamp);
        return this.isTatortTimeWindow(now);
      }),
    );
  }

  private isSunday(date: Date): boolean {
    return date.getDay() == 0;
  }

  private isTatortTimeWindow(date: Date): boolean {
    return this.isSunday(date) && date.getHours() >= 20 && date.getHours() < 23;
  }
}

class TV {
  private device: string;
  private _stream: Observable<boolean>;

  constructor(device: string) {
    this.device = device;

    this._stream = concat(this.initialValue, this.changes).pipe(
      distinctUntilChanged(),
    );
  }

  public get stream(): Observable<boolean> {
    return this._stream;
  }

  private get initialValue(): Observable<boolean> {
    const current = getState(`${this.device}.states.on`);
    if (current.notExist) {
      return EMPTY;
    }

    return of(current.val);
  }

  private get changes(): Observable<boolean> {
    return new Observable<boolean>(observer => {
      on({ id: `${this.device}.states.on`, change: 'ne', ack: true }, event => {
        observer.next(event.state.val);
      });
    }).pipe(share());
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

    this._stream = concat(this.initialValue, this.changes).pipe(
      distinctUntilChanged((last, next) => last.state.lc === next.state.lc),
    );
  }

  public get stream(): Observable<StateWithId> {
    return this._stream;
  }

  private get initialValue(): Observable<StateWithId> {
    const latest = this.stateBasedActivityIndicators
      .map(indicator => {
        return {
          id: indicator,
          state: getState(indicator),
        };
      })
      .filter(state => {
        if (state.state.notExist) {
          log(`${state.id} does not exist`);
          return false;
        }
        return true;
      })
      .map(state => {
        return {
          id: state.id,
          state: state.state as iobJS.State,
        };
      })
      .reduce((latest, state) => {
        if (!latest) {
          return state;
        }

        if (state.state.lc > latest.state.lc) {
          log(
            `Preferred ${state.id} over ${latest.id} (${state.state.lc} > ${latest.state.lc})`,
          );
          return state;
        }

        return latest;
      }, undefined);

    if (latest) {
      log(
        `Found latest activity from ${new Date(
          latest.state.lc,
        ).toLocaleString()}: ${JSON.stringify(latest)}`,
      );
      return of(latest);
    } else {
      log('No known latest activity');
      return EMPTY;
    }
  }

  private get changes(): Observable<StateWithId> {
    const stateChanges = new Observable<StateWithId>(observer => {
      on({ id: this.stateBasedActivityIndicators, ack: true }, event => {
        const state = {
          id: event.id,
          state: event.state,
        };

        observer.next(state);
      });
    }).pipe(share());

    return merge(stateChanges, ...this.customActivityIndicators);
  }

  private get stateBasedActivityIndicators(): string[] {
    return this.ids
      .filter(id => typeof id === 'string')
      .map(id => id.toString());
  }

  private get customActivityIndicators(): Observable<StateWithId>[] {
    return this.ids
      .filter(id => typeof id === 'function')
      .map((factory: () => Observable<StateWithId>) => factory());
  }
}

const tv = new TV(tvDevice);

const tvLog = tv.stream.pipe(tap(x => log(`TV on: ${x}`))).subscribe();

const timerDisabled = combineLatest([
  new WhitelistedApp(tvDevice, ...whitelistedLgApps).stream,
  new Tatort().stream,
]).pipe(
  map(flags => flags.some(f => f)),
  distinctUntilChanged(),
);

const timerDisabledNotifications = timerDisabled
  .pipe(
    tap(x => log(`Timer disabled: ${x}`)),
    tap(x => tv.message(`TV Idle ${x ? 'disabled' : 'enabled'}`)),
  )
  .subscribe();

const activity = new ActivityIndicator(...activityIndicators).stream;

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

const timeoutNotifications = timeoutPopups.map(left => {
  return activity
    .pipe(
      debounceTime(minutesToMs(turnOffAfter - left)),
      withLatestFrom(timerDisabled),
      filter(([_state, disabled]) => !disabled),
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
    debounceTime(minutesToMs(turnOffAfter)),
    withLatestFrom(timerDisabled),
    filter(([_state, disabled]) => !disabled),
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
