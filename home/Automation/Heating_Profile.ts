import { combineLatest } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

const config = {
  heatingPeriod: 'hm-rega.0.2322',
  warmProfileWhen: 'ping.0.iobroker.mobile-phone-sonja',
  profile: {
    normal: 'scene.0.Heating.Normal',
    warm: 'scene.0.Heating.Warm',
  },
};

const heatingPeriod = new Stream<boolean>(config.heatingPeriod).stream;
const warm = new Stream<boolean>(config.warmProfileWhen).stream;

const subscription = combineLatest([warm, heatingPeriod])
  .pipe(
    map(([warm, heatingPeriod]) => ({
      warm: warm,
      heatingPeriod: heatingPeriod,
    })),
    filter(x => x.heatingPeriod),
    map(x => x.warm),
    tap(warm => {
      if (warm) {
        setStateChanged(config.profile.warm, true);

        Notify.mobile(`Warm heating profile enabled`);
      } else {
        setStateChanged(config.profile.normal, true);

        Notify.mobile(`Normal heating profile enabled`);
      }
    }),
  )
  .subscribe();

onStop(() => {
  [subscription].forEach(x => x.unsubscribe());
});
