import { combineLatest, concat, EMPTY, Observable, of } from 'rxjs';
import {
  distinctUntilChanged,
  distinctUntilKeyChanged,
  filter,
  map,
  share,
  tap,
} from 'rxjs/operators';

class Stream<T> {
  private state: string;
  private _stream: Observable<T>;

  constructor(state: string) {
    this.state = state;

    this._stream = concat(this.initialValue, this.changes).pipe(
      distinctUntilChanged(),
    );
  }

  public get stream(): Observable<T> {
    return this._stream;
  }

  private get initialValue(): Observable<T> {
    const current = getState(this.state);
    if (current.notExist) {
      return EMPTY;
    }

    return of(current.val);
  }

  private get changes(): Observable<T> {
    return new Observable<T>(observer => {
      on({ id: this.state, ack: true }, event => {
        observer.next(event.state.val);
      });
    }).pipe(share());
  }
}

function determineScene(): string {
  let scene = 'scene.0.Bathroom.Lights_Default';

  if (compareTime('1:00', '6:00', 'between')) {
    scene = 'scene.0.Bathroom.Lights_Ultra_Low';

    // If any light is on, use a brighter scene.
    if (getState('scene.0.Lights.All_Lights_Off').val !== true) {
      scene = 'scene.0.Bathroom.Lights_Low';
    }
  }

  return scene;
}

const illuminationThreshold = 20;

const presence = new Stream<boolean>(
  'hm-rpc.1.000C1A49A87471.1.PRESENCE_DETECTION_STATE',
).stream;
const overriddenBySwitch = new Stream<boolean>('scene.0.Bathroom.Lights_Bright')
  .stream;
const illumination = new Stream<number>(
  'hm-rpc.1.000C1A49A87471.1.ILLUMINATION',
).stream;

const reactToPresence = combineLatest([
  presence,
  overriddenBySwitch,
  illumination,
]).pipe(
  map(([p, o, i]) => {
    return { presence: p, override: o, illumination: i };
  }),
  tap(x => log(JSON.stringify(x), 'debug')),
  filter(x => {
    if (x.override) {
      log('Bathroom lights overridden by switch');
      return false;
    }

    return true;
  }),
  distinctUntilKeyChanged('presence'),
);

const turnOff = reactToPresence
  .pipe(
    filter(x => x.presence === false),
    tap(_ => {
      log('Bathroom empty, turning off lights');
      setState('scene.0.Bathroom.Lights', false);
    }),
  )
  .subscribe();

const turnOn = reactToPresence
  .pipe(
    filter(x => x.presence === true),
    filter(x => x.illumination <= illuminationThreshold),
    map(x => {
      return { ...x, scene: determineScene() };
    }),
    tap(x => {
      log(`Bathroom occupied with ${x.illumination} lm, turning on ${x.scene}`);
      setState(x.scene, true);
    }),
  )
  .subscribe();

onStop(() => {
  [turnOn, turnOff].forEach(x => x.unsubscribe());
});
