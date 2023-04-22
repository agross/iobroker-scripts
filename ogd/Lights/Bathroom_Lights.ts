import { combineLatest, EMPTY, iif } from 'rxjs';
import {
  distinctUntilChanged,
  distinctUntilKeyChanged,
  filter,
  map,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs/operators';

const config = {
  presence: 'zigbee.0.54ef4410006bca59.occupancy',
  overriddenBy: 'scene.0.Bathroom.Lights_Bright',
  illumination: 'zigbee.0.54ef4410006bca59.illuminance_raw',
  illuminationThreshold: 80,
  turnOff: 'scene.0.Bathroom.Lights',
  determineScene: () => {
    const day = 'scene.0.Bathroom.Lights_Default';
    const dim = 'scene.0.Bathroom.Lights_Dim';
    const night = 'scene.0.Bathroom.Lights_Night';

    if (isAstroDay()) {
      log('Bathroom lights default');
      return day;
    } else {
      if (compareTime('23:00', '6:00', 'between')) {
        log('Bathroom lights night');
        return night;
      }

      log('Bathroom lights dim');
      return dim;
    }
  },
};

const presence = new Stream<boolean>(config.presence).stream;
const overridden = new Stream<boolean>(config.overriddenBy).stream;

const reactToPresence = combineLatest([overridden, presence]).pipe(
  filter(([overridden, _]) => {
    if (overridden) {
      log('Bathroom lights overridden by switch');
      return false;
    }

    return true;
  }),
  map(([_, presence]) => presence),
  distinctUntilChanged(),
  shareReplay(1),
);

const turnOff = reactToPresence
  .pipe(
    filter(present => present === false),
    tap(_ => {
      log('Bathroom unoccupied, turning off lights');
      setState(config.turnOff, false);
    }),
  )
  .subscribe();

const turnOn = reactToPresence
  .pipe(
    switchMap(present =>
      iif(
        () => {
          // If present, start monitoring illumination and turn on light
          // the first time it falls below the threshold.
          return present === true;
        },
        new Stream<number>(config.illumination).stream.pipe(
          map(x => {
            return {
              belowThreshold: x <= config.illuminationThreshold,
              illumination: x,
            };
          }),
          filter(x => x.belowThreshold),
          distinctUntilKeyChanged('belowThreshold'),
        ),
        EMPTY,
      ),
    ),
    map(x => {
      return { illumination: x.illumination, scene: config.determineScene() };
    }),
    tap(x => {
      log(`Bathroom occupied with ${x.illumination} lx, turning on ${x.scene}`);
      setState(x.scene, true);
    }),
  )
  .subscribe();

onStop(() => {
  [turnOn, turnOff].forEach(x => x.unsubscribe());
});
