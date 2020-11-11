import { concat, EMPTY, Observable, of } from 'rxjs';
import { distinctUntilChanged, share } from 'rxjs/operators';

declare global {
  export class Stream<T> {
    constructor(stateOrSubscribeOptions: string | iobJS.SubscribeOptions);
    get stream(): Observable<T>;
  }
}

export class Stream<T> {
  private _stream: Observable<T>;

  constructor(stateOrSubscribeOptions: string | iobJS.SubscribeOptions) {
    if (typeof stateOrSubscribeOptions === 'string') {
      this._stream = concat(
        this.initialValue(stateOrSubscribeOptions),
        this.stateChanges(stateOrSubscribeOptions),
      );
    } else {
      this._stream = this.changes(stateOrSubscribeOptions);
    }
  }

  public get stream(): Observable<T> {
    return this._stream.pipe(distinctUntilChanged());
  }

  private initialValue(state: string): Observable<T> {
    const current = getState(state);
    if (current.notExist) {
      return EMPTY;
    }

    return of(current.val);
  }

  private stateChanges(state: string): Observable<T> {
    return new Observable<T>(observer => {
      on({ id: state, ack: true }, event => {
        observer.next(event.state.val);
      });
    }).pipe(share());
  }

  private changes(subscribeOptions: iobJS.SubscribeOptions): Observable<T> {
    return new Observable<T>(observer => {
      on(subscribeOptions, event => {
        observer.next(event.state.val);
      });
    }).pipe(share());
  }
}
