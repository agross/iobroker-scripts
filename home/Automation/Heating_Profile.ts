import { tap } from 'rxjs/operators';

const config = {
  warmProfileWhen: 'ping.0.iobroker.mobile-phone-sonja',
  profile: {
    normal: 'scene.0.Heating.Normal',
    warm: 'scene.0.Heating.Warm',
  },
};

const subscription = new Stream<boolean>(config.warmProfileWhen).stream
  .pipe(
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
