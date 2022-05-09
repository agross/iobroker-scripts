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
  presence: 'zigbee.0.00158d0004ab6e83.occupancy',
  overriddenBy: 'scene.0.Hall.Lights_Bright',
  illumination: 'zigbee.0.00158d0004ab6e83.illuminance',
  illuminationThreshold: 40,
  turnOff: 'scene.0.Hall.Lights',
  determineScene: () => {
    let scene = 'scene.0.Hall.Lights_Default';

    if (compareTime('1:00', '6:00', 'between')) {
      scene = 'scene.0.Hall.Lights_Night';

      // If any light is on, use a brighter scene.
      if (getState('scene.0.Lights.All_Lights_Off').val !== true) {
        scene = 'scene.0.Hall.Lights_Dim';
      }
    }

    return scene;
  },
};

const presence = new Stream<boolean>(config.presence).stream;
const overridden = new Stream<boolean>(config.overriddenBy).stream;

const reactToPresence = combineLatest([overridden, presence]).pipe(
  filter(([overridden, _]) => {
    if (overridden) {
      log('Hall lights overridden by switch');
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
      log('Hall unoccupied, turning off lights');
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
      log(`Hall occupied with ${x.illumination} lx, turning on ${x.scene}`);
      setState(x.scene, true);
    }),
  )
  .subscribe();

onStop(() => {
  [turnOn, turnOff].forEach(x => x.unsubscribe());
});
