import { tap } from 'rxjs/operators';

const tvDevice = 'lgtv.0';
const ampDevice = 'mqtt.0.home.living-room.power.cmnd.gosund-sp111-1.POWER';

const tv = new Stream<boolean>(`${tvDevice}.states.on`).stream
  .pipe(tap(tvOn => setState(ampDevice, tvOn ? 'ON' : 'OFF')))
  .subscribe();

onStop(() => {
  tv.unsubscribe();
});
