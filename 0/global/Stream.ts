import { concat, EMPTY, Observable, of } from 'rxjs';
import { distinctUntilChanged, share } from 'rxjs/operators';

declare global {
  export class Stream<T> {
    constructor(state: string);
    get stream(): Observable<T>;
  }
}

export class Stream<T> {
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
