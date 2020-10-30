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

const workingThreshold = 5;
const finishedThreshold = 20;
const device = 'alias.0.mqtt.0.home.bathroom.power.gosund-sp111-3.power';

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
  // Last 6 values, 10 s intervals, e.g. [3, 69, 4, 77, 3, 3, 2, 2, 2, 2]
  bufferCount(6),
  tap(watts => log(`Buffer ${watts}`, 'debug')),
  map(watts => watts.reduce((acc, x) => acc + x, 0)),
  filter(watts => watts < finishedThreshold),
);

const done = running
  .pipe(
    // Maybe exhaustMap is better?
    switchMap(_ => notRunning.pipe(first())),
    tap(_ => Notifier.notify(`Washing machine has finished`)),
  )
  .subscribe();

onStop(() => {
  done.unsubscribe();
});
