import {
  startWith,
  share,
  distinctUntilChanged,
  tap,
  map,
  withLatestFrom,
  filter,
} from 'rxjs/operators';
import { Observable, combineLatest } from 'rxjs';

const globalBrightnessOverride = 'global-brightness-override';

createState(globalBrightnessOverride, undefined, {
  name: 'Global brightness override',
  type: 'number',
  role: 'level.dimmer',
  common: {
    custom: {
      'lovelace.0': {
        enabled: true,
        entity: 'input_number',
        name: 'Global brightness override',
        mode: 'number',
        min: 0,
        max: 100,
        step: 1,
      },
    },
  },
});

const brightnessChanges = new Observable<number>(observer => {
  on({ id: globalBrightnessOverride, change: 'ne' }, event => {
    observer.next(event.state.val as number);
  });
}).pipe(
  filter(brightness => brightness !== null),
  share(),
  distinctUntilChanged(),
);

interface LightState {
  id: string;
  on: boolean;
}

const lightStates: Observable<LightState>[] = [];

$('state[role=switch][id=*.state](functions=funcLight)').each(light => {
  log(`Monitoring ${light}`);

  const stateChanges = new Observable<LightState>(observer => {
    on({ id: light, change: 'ne' }, event => {
      observer.next({ id: light, on: event.state.val as boolean });
    });
  }).pipe(
    startWith({ id: light, on: getState(light).val as boolean }),
    share(),
    distinctUntilChanged(),
  );

  lightStates.push(stateChanges);
});

const onLights = combineLatest(lightStates).pipe(
  map(states => {
    return states
      .filter(state => state.on)
      .reduce((acc, curr) => acc.concat(curr.id), [] as string[]);
  }),
  distinctUntilChanged(),
  tap(lights => log(`${lights.length} lights turned on`)),
);

brightnessChanges
  .pipe(
    withLatestFrom(onLights),
    filter(([_level, lightsToSet]) => lightsToSet.length > 0),
    tap(([level, lightsToSet]) => {
      log(
        `Setting brightness ${level} on ${lightsToSet.length} devices: ${lightsToSet}`,
      );

      lightsToSet.forEach(light => {
        const brightness = light.replace(/.state$/, '.brightness');

        setState(brightness, level);
      });
    }),
  )
  .subscribe();
