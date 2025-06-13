import { concat, EMPTY, Observable, of } from 'rxjs';
import { distinctUntilChanged, share } from 'rxjs/operators';

declare global {
  export class Stream<T> {
    constructor(
      stateOrSubscribeOptions: string | iobJS.SubscribeOptions,
      options?: StreamOptions<T>,
    );
    get stream(): Observable<T>;
  }

  export interface StreamOptions<T> {
    map?: EventMapper<T>;
    pipe?: (obs: Observable<T>) => Observable<T>;
  }

  export type EventMapper<T> = (event: iobJS.ChangedStateObject) => T;
}

export class Stream<T> {
  private _stream: Observable<T>;

  constructor(
    stateOrSubscribeOptions: string | iobJS.SubscribeOptions,
    {
      map = e => e.state.val,
      pipe = $ => $.pipe(distinctUntilChanged()),
    }: StreamOptions<T> = {},
  ) {
    if (typeof stateOrSubscribeOptions === 'string') {
      this._stream = concat(
        this.initialValue(stateOrSubscribeOptions, map),
        this.stateChanges(stateOrSubscribeOptions, map),
      );
    } else {
      this._stream = this.changes(stateOrSubscribeOptions, map);
    }

    this._stream = pipe(this._stream);
  }

  public get stream(): Observable<T> {
    return this._stream;
  }

  private initialValue(
    state: string,
    eventMapper?: EventMapper<T>,
  ): Observable<T> {
    if (!existsState(state)) {
      log(
        `Initial state value does not exist: ${state}. Did the ObjectCreator finish creating states?`,
        'error',
      );

      return EMPTY;
    }

    const current = getState(state);
    if (current.notExist) {
      return EMPTY;
    }

    const currentAsEvent: iobJS.ChangedStateObject = {
      _id: state,
      id: state,
      from: current.from,
      ack: current.ack,
      ts: current.ts,
      lc: current.lc,
      common: undefined,
      native: undefined,
      type: undefined,
      oldState: undefined,
      newState: current,
      state: current,
    };

    return of(eventMapper(currentAsEvent));
  }

  private stateChanges(
    state: string,
    eventMapper?: EventMapper<T>,
  ): Observable<T> {
    return new Observable<T>(observer => {
      on({ id: state, ack: true }, event => {
        observer.next(eventMapper(event));
      });
    }).pipe(share());
  }

  private changes(
    subscribeOptions: iobJS.SubscribeOptions,
    eventMapper?: EventMapper<T>,
  ): Observable<T> {
    return new Observable<T>(observer => {
      on(subscribeOptions, event => {
        observer.next(eventMapper(event));
      });
    }).pipe(share());
  }
}
