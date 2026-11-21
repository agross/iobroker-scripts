import { combineLatest } from 'rxjs';
import {
  concatMap,
  distinctUntilChanged,
  map,
  startWith,
} from 'rxjs/operators';

const config = {
  presence: PresenceConfig.presenceState,
  heatingPeriod: '0_userdata.0.Heating.period',
  warmProfileWhen: 'ping.0.iobroker.mobile-phone-sonja',
  scenes: {
    off: 'scene.0.Heating.Off',
    away: 'scene.0.Heating.Away',
    normal: 'scene.0.Heating.Normal',
    warm: 'scene.0.Heating.Warm',
  },
};

const presence = new Stream<boolean>(config.presence).stream;
const heatingPeriod = new Stream<boolean>(config.heatingPeriod).stream;
const warmProfile = new Stream<boolean>(config.warmProfileWhen).stream.pipe(
  startWith(false),
);

const heating = combineLatest([warmProfile, presence, heatingPeriod])
  .pipe(
    map(([warm, present, inSeason]) => {
      if (!inSeason) {
        return config.scenes.off;
      }

      if (!present) {
        return config.scenes.away;
      }

      return warm ? config.scenes.warm : config.scenes.normal;
    }),
    distinctUntilChanged(),
    concatMap(async scene => {
      log(`Activating heating scene ${scene}`);

      try {
        await setStateAsync(scene, true);
      } catch (error) {
        log(`Could not activate heating scene ${scene}: ${error}`, 'error');
        return;
      }
    }),
  )
  .subscribe();

onStop(() => heating.unsubscribe());
