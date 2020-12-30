import { Observable } from 'rxjs';
import {
  bufferCount,
  filter,
  first,
  map,
  share,
  switchMap,
  tap,
} from 'rxjs/operators';

const workingThreshold = 10;
const finishedThreshold = 20;
const device = 'alias.0.mqtt.0.home.bathroom.power.gosund-sp111-3.power';
const powerState = 'alias.0.mqtt.0.home.bathroom.power.gosund-sp111-3.state';

const powerUsage = new Observable<number>(observer => {
  on({ id: device, ack: true }, event => {
    observer.next(event.state.val as number);
  });
}).pipe(share());

const running = powerUsage.pipe(
  tap(watts => log(`Usage ${JSON.stringify(watts)}`, 'debug')),
  filter(watts => watts >= workingThreshold),
);

const notRunning = powerUsage.pipe(
  // Last 6 values, 10 s intervals, e.g. [3, 3, 3, 2, 2, 2]
  bufferCount(6),
  tap(watts => log(`Buffer ${watts}`)),
  map(watts => watts.reduce((acc, x) => acc + x, 0)),
  filter(watts => watts < finishedThreshold),
);

const done = running
  .pipe(
    switchMap(_ => notRunning.pipe(first())),
    tap(_ => Notify.mobile(`Washing machine has finished`)),
    tap(_ => setState(powerState, false)),
  )
  .subscribe();

onStop(() => {
  done.unsubscribe();
});
