import { concat, EMPTY, Observable, of } from 'rxjs';
import { distinctUntilChanged, share } from 'rxjs/operators';

declare global {
  export class Stream<T> {
    constructor(
      stateOrSubscribeOptions: string | iobJS.SubscribeOptions,
      eventMapper?: EventMapper<T>,
      everyValue?: boolean,
    );
    get stream(): Observable<T>;
  }

  export type EventMapper<T> = (event: iobJS.ChangedStateObject) => T;
}

export class Stream<T> {
  private _stream: Observable<T>;

  constructor(
    stateOrSubscribeOptions: string | iobJS.SubscribeOptions,
    eventMapper?: EventMapper<T>,
    everyValue?: boolean,
  ) {
    if (!eventMapper) {
      eventMapper = e => e.state.val;
    }

    if (typeof stateOrSubscribeOptions === 'string') {
      this._stream = concat(
        this.initialValue(stateOrSubscribeOptions, eventMapper),
        this.stateChanges(stateOrSubscribeOptions, eventMapper),
      );
    } else {
      this._stream = this.changes(stateOrSubscribeOptions, eventMapper);
    }

    if (!everyValue) {
      this._stream = this._stream.pipe(distinctUntilChanged());
    }
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
      newState: current as iobJS.State,
      state: current as iobJS.State,
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
