import { iif, of } from 'rxjs';
import { delay, switchMap, tap } from 'rxjs/operators';

const config = {
  tvDevice: 'lgtv.0',
  ampDevice: 'mqtt.0.home.living-room.power.cmnd.gosund-sp111-1.POWER',
};

const tv = new Stream<boolean>(`${config.tvDevice}.states.on`).stream
  .pipe(
    switchMap(tvOn =>
      iif(() => tvOn === true, of(true), of(false).pipe(delay(10000))),
    ),
    tap(tvOn => log(`TV is ${tvOn ? 'on' : 'off'}`)),
    tap(tvOn => setState(config.ampDevice, tvOn ? 'ON' : 'OFF')),
  )
  .subscribe();

onStop(() => {
  tv.unsubscribe();
});
