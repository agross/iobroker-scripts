import { tap } from 'rxjs/operators';

const config = {
  tvDevice: 'lgtv.0',
  ampDevice: 'mqtt.0.home.living-room.power.cmnd.gosund-sp111-1.POWER',
};

const tv = new Stream<boolean>(`${config.tvDevice}.states.on`).stream
  .pipe(tap(tvOn => setState(config.ampDevice, tvOn ? 'ON' : 'OFF')))
  .subscribe();

onStop(() => {
  tv.unsubscribe();
});
