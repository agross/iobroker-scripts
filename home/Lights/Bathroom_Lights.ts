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
  presence: 'hm-rpc.1.000C1A49A87471.1.PRESENCE_DETECTION_STATE',
  overriddenBy: 'scene.0.Bathroom.Lights_Bright',
  illumination: 'hm-rpc.1.000C1A49A87471.1.ILLUMINATION',
  illuminationThreshold: 20,
  turnOff: 'scene.0.Bathroom.Lights',
  determineScene: () => {
    let scene = 'scene.0.Bathroom.Lights_Default';

    if (compareTime('1:00', '6:00', 'between')) {
      scene = 'scene.0.Bathroom.Lights_Ultra_Dim';

      // If any light is on, use a brighter scene.
      if (getState('scene.0.Lights.All_Lights_Off').val !== true) {
        scene = 'scene.0.Bathroom.Lights_Dim';
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
      log(`Bathroom occupied with ${x.illumination} lm, turning on ${x.scene}`);
      setState(x.scene, true);
    }),
  )
  .subscribe();

onStop(() => {
  [turnOn, turnOff].forEach(x => x.unsubscribe());
});
