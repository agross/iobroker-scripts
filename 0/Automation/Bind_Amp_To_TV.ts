import { concat, Observable, empty, of } from 'rxjs';
import { distinctUntilChanged, tap, share } from 'rxjs/operators';

const tvDevice = 'lgtv.0';
const ampDevice = 'mqtt.0.home.living-room.power.cmnd.gosund-sp111-1.POWER';

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
      return empty();
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
}

const tv = new TV(tvDevice).stream
  .pipe(tap(tvOn => setState(ampDevice, tvOn ? 'ON' : 'OFF')))
  .subscribe();

onStop(() => {
  [tv].forEach(subscription => subscription.unsubscribe());
});
