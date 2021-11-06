import {
  startWith,
  share,
  distinctUntilChanged,
  tap,
  map,
  withLatestFrom,
  filter,
  distinctUntilKeyChanged,
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
        name: 'Global Brightness Override',
        type: 'number',
        def: 50,
        read: true,
        write: true,
        role: 'level.dimmer',
        custom: {
          'lovelace.0': {
            enabled: true,
            entity: 'input_number',
            name: Lovelace.id('Global Brightness Override'),
            min: 0,
            max: 100,
            step: 1,
            attr_icon: 'mdi:lightbulb-on-outline',
          },
        },
      } as iobJS.StateCommon,
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
  on({ id: state, ack: false }, event => {
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

const lightStates: Observable<LightState>[] = [
  ...$('state[role=switch][id=*.state](functions=light)'),
].map(light => {
  log(`Monitoring ${light} (${getState(light).val ? 'on' : 'off'})`);

  return new Observable<LightState>(observer => {
    on({ id: light, ack: true }, event => {
      observer.next({ id: light, on: event.state.val as boolean });
    });
  }).pipe(
    startWith({ id: light, on: getState(light).val as boolean }),
    distinctUntilChanged((x, y) => JSON.stringify(x) === JSON.stringify(y)),
  );
});

const onLights = combineLatest(lightStates).pipe(
  map(states => {
    return states
      .filter(state => state.on)
      .reduce((acc, curr) => acc.concat(curr.id), [] as string[]);
  }),
  distinctUntilChanged((x, y) => x.sort().join() === y.sort().join()),
);

const logOnLights = onLights
  .pipe(
    tap(lights =>
      log(`${lights.length} lights turned on: ${lights.sort().join(', ')}`),
    ),
  )
  .subscribe();

const setBrightness = brightnessChanges
  .pipe(
    withLatestFrom(onLights),
    filter(([_level, lightsToSet]) => lightsToSet.length > 0),
    tap(([level, lightsToSet]) => {
      log(
        `Setting brightness ${level} on ${
          lightsToSet.length
        } devices: ${lightsToSet.join(', ')}`,
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

interface LightBrightness {
  id: string;
  brightness: number;
}

const lightBrightnesses: Observable<LightBrightness>[] = [
  ...$('state[role=level.dimmer][id=*.brightness](functions=light)'),
].map(brightness => {
  log(`Monitoring ${brightness} (${getState(brightness).val})`);

  return new Observable<LightBrightness>(observer => {
    on({ id: brightness, ack: true }, event => {
      observer.next({ id: brightness, brightness: event.state.val as number });
    });
  }).pipe(
    startWith({
      id: brightness,
      brightness: getState(brightness).val as number,
    }),
    distinctUntilKeyChanged('brightness'),
  );
});

const minimumBrightnessOfOnLights = combineLatest([
  combineLatest(lightBrightnesses),
  onLights,
])
  .pipe(
    map(([brightnesses, onLights]) => {
      return { on: onLights, brightnesses: brightnesses };
    }),
    map(lights =>
      lights.on
        .map(on =>
          lights.brightnesses.find(
            b => b.id.replace(/\.brightness$/, '.state') === on,
          ),
        )
        .filter(b => !!b),
    ),
    filter(brightnesses => brightnesses.length > 0),
    map(brightnesses => Math.min(...brightnesses.map(b => b.brightness))),
    distinctUntilChanged(),
    tap(min => {
      log(`Minimum brightness among on lights: ${min}`);
      setState(state, min, true);
    }),
  )
  .subscribe();

onStop(() =>
  [setBrightness, minimumBrightnessOfOnLights, logOnLights].forEach(x =>
    x.unsubscribe(),
  ),
);
