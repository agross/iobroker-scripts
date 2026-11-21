import { combineLatest } from 'rxjs';
import {
  concatMap,
  distinctUntilChanged,
  filter,
  map,
  tap,
} from 'rxjs/operators';

const config = {
  presence: PresenceConfig.presenceState,
  heatingPeriod: '0_userdata.0.Heating.period',
  warmProfileWhen: 'ping.0.iobroker.mobile-phone-sonja',
  profile: {
    normal: 'scene.0.Heating.Normal',
    warm: 'scene.0.Heating.Warm',
  },
  thermostats: [
    'hm-rpc.0.000A1A49A131B3.1', // Bathroom towel warmer
    'hm-rpc.0.000C9A499EE42F.1', // Bathroom
    'hm-rpc.0.000C9A499EE1B6.1', // Bedroom
    'hm-rpc.0.000C9A498DC865.1', // Living room
    'hm-rpc.0.000C9A499EEBB3.1', // Office
  ],
};

const presence = new Stream<boolean>(config.presence).stream;
const heatingPeriod = new Stream<boolean>(config.heatingPeriod).stream;
const warmProfile = new Stream<boolean>(config.warmProfileWhen).stream;

const heating = combineLatest([presence, heatingPeriod])
  .pipe(
    map(([present, inSeason]) => (present && inSeason ? 'automatic' : 'off')),
    distinctUntilChanged(),
    concatMap(async mode => {
      log(`Setting heating to ${mode}`);

      await Promise.all(
        config.thermostats.map(async thermostat => {
          try {
            await setStateAsync(
              `${thermostat}.CONTROL_MODE`,
              mode === 'automatic' ? 0 : 1,
            );
            if (mode !== 'automatic') {
              // 4.5 °C is the minimum setpoint exposed by hm-rpc (valve off).
              await setStateAsync(`${thermostat}.SET_POINT_TEMPERATURE`, 4.5);
            }
          } catch (error) {
            log(
              `Could not set heating to ${mode} on ${thermostat}: ${error}`,
              'error',
            );
          }
        }),
      );
    }),
  )
  .subscribe();

const profile = combineLatest([warmProfile, heatingPeriod])
  .pipe(
    filter(([, inSeason]) => inSeason),
    tap(([warm]) => {
      setStateChanged(warm ? config.profile.warm : config.profile.normal, true);

      Notify.mobile(`${warm ? 'Warm' : 'Normal'} heating profile enabled`);
    }),
  )
  .subscribe();

onStop(() => {
  heating.unsubscribe();
  profile.unsubscribe();
});
