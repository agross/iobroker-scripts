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

const override = ['0_userdata.0', 'global-brightness-override'];
const state = override.join('.');
const remote = 'hm-rpc.1.000B5A49A07F8D';
const change = 5;

await ObjectCreator.create(
  {
    [override[1]]: {
      type: 'state',
      common: {
        name: 'Global brightness override',
        type: 'number',
        def: 50,
        read: true,
        write: true,
        role: 'level.dimmer',
        custom: {
          'lovelace.0': {
            enabled: true,
            entity: 'input_number',
            name: 'Global brightness override',
            min: 0,
            max: 100,
            step: 1,
          },
        },
      } as iobJS.StateCommon & iobJS.CustomCommon,
      native: {},
    },
  },
  override[0],
);

on({ id: `${remote}.3.PRESS_LONG`, ack: true }, _ => {
  let brightness = getState(state).val - change;

  if (brightness < 1) {
    brightness = 1;
  }

  setState(state, brightness);
});

on({ id: `${remote}.4.PRESS_LONG`, ack: true }, _ => {
  let brightness = getState(state).val + change;

  if (brightness > 100) {
    brightness = 100;
  }

  setState(state, brightness);
});

const brightnessChanges = new Observable<number>(observer => {
  on({ id: state, change: 'ne' }, event => {
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

const subscription = brightnessChanges
  .pipe(
    withLatestFrom(onLights),
    filter(([_level, lightsToSet]) => lightsToSet.length > 0),
    tap(([level, lightsToSet]) => {
      log(
        `Setting brightness ${level} on ${lightsToSet.length} devices: ${lightsToSet}`,
      );

      lightsToSet.forEach(light => {
        const brightness = light.replace(/.state$/, '.brightness');

        if (existsState(brightness)) {
          setState(brightness, level);
        }
      });
    }),
  )
  .subscribe();

onStop(() => subscription.unsubscribe());
