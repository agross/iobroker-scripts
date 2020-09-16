import { interval, Observable, of, EMPTY, concat, combineLatest } from 'rxjs';
import {
  share,
  distinctUntilChanged,
  tap,
  map,
  timestamp,
  debounceTime,
  withLatestFrom,
  filter,
} from 'rxjs/operators';

const activityIndicators = [
  'kodi.0.info.playing_time',
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
    setState(`${this.device}.states.popup`, message);
  }

  public turnOff(): void {
    setState(`${this.device}.states.power`, false, false);
  }
}

class ActivityIndicator {
  private ids: string[];
  private _stream: Observable<StateWithId>;

  constructor(...ids: string[]) {
    this.ids = ids;

    this._stream = concat(this.initialValue, this.changes).pipe(
      distinctUntilChanged((last, next) => last.state.lc === next.state.lc),
    );
  }

  public get stream(): Observable<StateWithId> {
    return this._stream;
  }

  private get initialValue(): Observable<StateWithId> {
    const latest = activityIndicators
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
    return new Observable<StateWithId>(observer => {
      on({ id: this.ids, ack: true }, event => {
        const state = {
          id: event.id,
          state: event.state,
        };

        observer.next(state);
      });
    }).pipe(share());
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

const activityLog = activity
  .pipe(
    withLatestFrom(tv.stream),
    filter(([_state, tvOn]) => tvOn),
    map(([state, _tvOn]) => state),
    tap(x => log(`Activity: ${x.id}`)),
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
