import {
  Observable,
  merge,
  combineLatest,
  Subscription,
  NEVER,
  concat,
  of,
} from 'rxjs';
import {
  filter,
  map,
  startWith,
  withLatestFrom,
  distinctUntilChanged,
  timeInterval,
  share,
  tap,
  delay,
  take,
  exhaustMap,
} from 'rxjs/operators';

declare global {
  namespace Remotes {
    type States = string[] | ObjectsWithStateQuery;

    interface CycleConfig {
      off: string;
      on: string[] | (() => string[]);
    }

    interface CycleConfigWithDynamicOff {
      off: string | (() => string);
      on: string[] | (() => string[]);
    }

    interface ToggleConfig {
      off?: States;
      states: States;
    }

    interface DimmerConfig {
      brightnessChange: number;
      lights: Observable<string[]>;
    }

    interface DeviceConfig {
      device: string;
    }

    interface DimmerDeviceConfig {
      dim?: DimmerConfig;
    }

    interface ToggleDeviceConfig {
      toggle?: ToggleConfig;
    }

    interface CycleDeviceConfig {
      cycle?: CycleConfig;
    }

    interface CycleDeviceConfigWithDynamicOff {
      cycle?: CycleConfigWithDynamicOff;
    }

    interface MaximumBrightnessSceneDeviceConfig {
      max_brightness_scenes?: string[];
    }

    abstract class Remote {
      setUp(): Subscription;
    }

    class AqaraWS_EUK03 extends Remote {
      constructor(
        config: DeviceConfig & ToggleDeviceConfig & CycleDeviceConfig,
      );
    }

    class AqaraWRS_R02 extends Remote {
      constructor(
        config: DeviceConfig &
          CycleDeviceConfig &
          DimmerDeviceConfig &
          MaximumBrightnessSceneDeviceConfig,
      );
    }

    class TradfriDimmer extends Remote {
      constructor(
        config: DeviceConfig &
          DimmerDeviceConfig &
          ToggleDeviceConfig &
          CycleDeviceConfigWithDynamicOff,
      );
    }

    class Philips extends Remote {
      constructor(
        config: DeviceConfig &
          DimmerDeviceConfig &
          ToggleDeviceConfig &
          CycleDeviceConfigWithDynamicOff,
      );
    }

    class Shelly extends Remote {
      constructor(
        config: DeviceConfig & ToggleDeviceConfig & CycleDeviceConfig,
      );
    }

    interface ObjectsWithStateQueryConfig {
      rooms: string | string[];
      functions: string | string[];
    }

    class ObjectsWithStateQuery {
      constructor(config: ObjectsWithStateQueryConfig);
      forEach(
        callbackfn: (value: string, index: number, array: string[]) => void,
        thisArg?: any,
      ): void;
      map<U>(
        callbackfn: (value: string, index: number, array: string[]) => U,
        thisArg?: any,
      ): U[];
      values(): string[];
      get length(): number;
    }

    class DimmableLights {
      static for(...ids: string[]): Observable<string[]>;
    }
  }
}

export namespace Remotes {
  interface IFeature {
    setUp(): Subscription;
  }

  type State = string | (() => string);
  type States = string[] | (() => string[]) | ObjectsWithStateQuery;

  interface CycleConfig {
    off: string;
    on: string[] | (() => string[]);
  }

  interface CycleConfigWithDynamicOff {
    off: string | (() => string);
    on: string[] | (() => string[]);
  }

  interface CycleStreams {
    off: Observable<{ device: string; state: State }>;
    next: Observable<{ device: string; states: States }>;
  }

  // Cycle through different states (i.e. scenes) when turning on, set state when
  // turned off.
  class Cycle implements IFeature {
    private readonly config: CycleStreams;

    constructor(config: CycleStreams) {
      this.config = config;
    }

    public setUp(): Subscription {
      const off = this.config.off.pipe(
        tap(({ device, state }) => {
          if (typeof state === 'function') {
            state = state();
          }

          log(`${device}: Turned off`);

          setState(state, false);
        }),
      );

      const next = this.config.next.pipe(
        tap(({ device, states }) => {
          if (typeof states === 'function') {
            states = states();
          }

          const currentIndex = states
            .map(state => ({ object: state, state: getState(state) }))
            .reduce((acc, state, index) => {
              if (acc < 0 && state.state.val === true) {
                return index;
              }

              return acc;
            }, -1);

          const activate = states[currentIndex + 1] || states[0];
          log(`${device}: Cycle next: ${activate}`);

          setState(activate, true);
        }),
      );

      return [off, next].reduce((acc, $: Observable<any>) => {
        acc.add($.subscribe());
        return acc;
      }, new Subscription());
    }
  }

  interface ToggleConfig {
    off?: States;
    states: States;
  }

  interface ToggleAndSwitchStreams {
    turnedOn: Observable<{ device: string; states: States; off?: States }>;
    turnedOff: Observable<{ device: string; states: States; off?: States }>;
  }

  // Whenever the remote switches state, either turn on states (if none is on)
  // or off (if any is on).
  // For Shellies the state that was switched to does not matter, rather the
  // state of toggled objects.
  // There are two variations:
  //   1. The "any is on" state is determined by `states` states
  //
  //      If any is on, set `states` to false, otherwise set `states` to true.
  //
  //   2. The "any is on" state is determined by the optional `off` states
  //
  //      If any is on, set `off` to false, otherwise set `states` to true.
  //
  //      This allows you to have a scene that controls light states by having set
  //      points for true and false where true turns everything on and false turns
  //      everything off. If any light is on, the scene becomes `true` or
  //      `uncertain` ("any is on" == true). By turning off that scene all lights
  //      are then turned off.
  class ToggleAndSwitch implements IFeature {
    private readonly config: ToggleAndSwitchStreams;

    constructor(config: ToggleAndSwitchStreams) {
      this.config = config;
    }

    public setUp(): Subscription {
      const toggled = merge(this.config.turnedOn, this.config.turnedOff).pipe(
        map(({ device, states, off }) => {
          let anyOnDeterminedBy = off || states;

          if (typeof anyOnDeterminedBy === 'function') {
            anyOnDeterminedBy = anyOnDeterminedBy();
          }

          const anyOn = anyOnDeterminedBy
            .map(object => getState(object))
            .filter(state => !state.notExist)
            .some(state => state.val);

          log(
            `${device}: Toggled. ${
              anyOn ? 'Some' : 'None'
            } are on: ${JSON.stringify(anyOnDeterminedBy)}`,
          );

          return { device, states, off, anyOn };
        }),
        share(),
      );

      const noneOn = toggled.pipe(
        filter(x => !x.anyOn),
        tap(({ device, states, off, anyOn }) => {
          if (typeof states === 'function') {
            states = states();
          }

          log(`${device}: None on. Setting true for ${JSON.stringify(states)}`);

          states.forEach(state => setState(state, true));
        }),
      );

      const someOn = toggled.pipe(filter(x => x.anyOn));

      const explicitOffTurnedOff = someOn.pipe(
        filter(x => !!x.off),
        tap(({ device, states, off, anyOn }) => {
          if (typeof off === 'function') {
            off = off();
          }

          log(
            `${device}: Explicit off. Setting false for ${JSON.stringify(off)}`,
          );

          off.forEach(state => setState(state, false));
        }),
      );

      const implicitOffTurnedOff = someOn.pipe(
        filter(x => !x.off),
        tap(({ device, states, off, anyOn }) => {
          if (typeof states === 'function') {
            states = states();
          }

          log(
            `${device}: Implicit off. Setting false for ${JSON.stringify(
              states,
            )}`,
          );

          states.forEach(state => setState(state, false));
        }),
      );

      return [noneOn, explicitOffTurnedOff, implicitOffTurnedOff].reduce(
        (acc, $) => {
          acc.add($.subscribe());
          return acc;
        },
        new Subscription(),
      );
    }
  }

  interface MaximumBrightnessSceneStreams {
    turnedOn: Observable<{ device: string; states: States }>;
  }

  class MaximumBrightnessScene implements IFeature {
    private readonly config: MaximumBrightnessSceneStreams;

    constructor(config: MaximumBrightnessSceneStreams) {
      this.config = config;
    }

    public setUp(): Subscription {
      return this.config.turnedOn
        .pipe(
          tap(({ device, states }) => {
            if (typeof states === 'function') {
              states = states();
            }

            log(`${device}: Setting true for ${JSON.stringify(states)}`);

            states.forEach(state => setState(state, true));
          }),
        )
        .subscribe();
    }
  }

  interface DimmerConfig {
    brightnessChange: number;
    lights: Observable<string[]>;
  }

  interface DimmerStreams {
    brightnessChange: number;
    brighter: Observable<string>;
    darker: Observable<string>;
    stop: Observable<string>;
    lights: Observable<string[]>;
  }

  class Dimmer implements IFeature {
    readonly config: DimmerStreams;

    constructor(config: DimmerStreams) {
      this.config = config;
    }

    public setUp(): Subscription {
      const darker = this.config.darker
        .pipe(withLatestFrom(this.config.lights))
        .pipe(
          tap(([device, states]) => {
            log(`${device}: Starting darker dimmer`);

            states.forEach(light => setState(`${light}.brightness_move`, -30));
          }),
        );

      const brighter = this.config.brighter
        .pipe(withLatestFrom(this.config.lights))
        .pipe(
          tap(([device, states]) => {
            log(`${device}: Starting brighter dimmer`);

            states.forEach(light => setState(`${light}.brightness_move`, 30));
          }),
        );

      const stop = this.config.stop
        .pipe(withLatestFrom(this.config.lights))
        .pipe(
          tap(([device, states]) => {
            log(`${device}: Stopping dimmer`);

            states.forEach(light => setState(`${light}.brightness_move`, 0));
          }),
        );

      return [darker, brighter, stop].reduce((acc, $) => {
        acc.add($.subscribe());
        return acc;
      }, new Subscription());
    }

    private makeDarker(states: States) {
      this.changeBrightness(
        states,
        (ref, brightness) => brightness < (ref || Infinity),
        brightness => brightness - this.config.brightnessChange,
      );
    }

    private makeBrighter(states: States) {
      this.changeBrightness(
        states,
        (ref, brightness) => brightness > (ref || -Infinity),
        brightness => brightness + this.config.brightnessChange,
      );
    }

    private changeBrightness(
      states: States,
      selector: (reference: number, brightness: number) => boolean,
      newBrightness: (brightness: number) => number,
    ) {
      if (typeof states === 'function') {
        states = states();
      }

      const brightnesses = states.map(light => `${light}.brightness`);

      const minBrightness = brightnesses
        .map(stateId => ({ source: stateId, state: getState(stateId) }))
        .filter(state => !state.state.notExist && state.state.val)
        .reduce(
          (acc, item) => (selector(acc.state.val, item.state.val) ? item : acc),
          { source: undefined, state: { val: undefined } },
        );

      if (!minBrightness.source) {
        return;
      }

      log(
        `Picked ${minBrightness.source} "${minBrightness.state.val}" as reference`,
      );

      let brightness = newBrightness(minBrightness.state.val);
      if (brightness <= 0) {
        // Keep lights on.
        brightness = 1;
      }
      if (brightness > 100) {
        brightness = 100;
      }

      log(`Setting brightness ${brightness}`);
      brightnesses.forEach(b => setState(b, brightness));
    }
  }

  interface DeviceConfig {
    device: string;
  }

  interface DimmerDeviceConfig {
    dim?: DimmerConfig;
  }

  interface ToggleDeviceConfig {
    toggle?: ToggleConfig;
  }

  interface CycleDeviceConfig {
    cycle?: CycleConfig;
  }

  interface CycleDeviceConfigWithDynamicOff {
    cycle?: CycleConfigWithDynamicOff;
  }

  interface MaximumBrightnessSceneDeviceConfig {
    max_brightness_scenes?: string[];
  }

  abstract class Remote {
    private readonly features: IFeature[] = [];

    public setUp(): Subscription {
      return this.features
        .map(f => f.setUp())
        .reduce((acc: Subscription, $) => {
          acc.add($);
          return acc;
        }, new Subscription());
    }

    protected addFeature(...feature: IFeature[]): void {
      feature.forEach(feature => this.features.push(feature));
    }
  }

  export class AqaraWS_EUK03 extends Remote {
    constructor(
      config: DeviceConfig &
        ToggleDeviceConfig &
        CycleDeviceConfig &
        MaximumBrightnessSceneDeviceConfig,
    ) {
      super();

      const features: IFeature[] = [];

      if (config.toggle) {
        features.push(new ToggleAndSwitch(this.toggleStreams(config)));
      }

      if (config.cycle) {
        features.push(new Cycle(this.cycleStreams(config)));
      }

      this.addFeature(...features);
    }

    private toggleStreams(
      config: DeviceConfig & ToggleDeviceConfig,
    ): ToggleAndSwitchStreams {
      const clicked = new Observable<string>(observer =>
        on({ id: `${config.device}.single`, val: true, ack: true }, event =>
          observer.next(event.id),
        ),
      ).pipe(
        share(),
        map(_event => ({
          device: config.device,
          states: config.toggle.states,
          off: config.toggle.off,
        })),
      );

      // Since both streams are merged, only pass the click event.
      return {
        turnedOn: clicked,
        turnedOff: NEVER,
      };
    }

    private cycleStreams(
      config: DeviceConfig & CycleDeviceConfig,
    ): CycleStreams {
      const switched = new Observable<string>(observer =>
        on({ id: `${config.device}.single`, val: true, ack: true }, event =>
          observer.next(event.id),
        ),
      ).pipe(share());

      const lightState = new Observable<iobJS.TypedState>(observer => {
        on({ id: config.cycle.off, ack: true }, event =>
          observer.next(event.state),
        );
      }).pipe(
        share(),
        startWith(getState(config.cycle.off)),
        // False -> false.
        // Anything else (true and Uncertain, for scenes) -> true.
        map(state => state.val !== false),
        distinctUntilChanged(),
      );

      const doSomething = switched.pipe(
        timeInterval(),
        withLatestFrom(lightState),
      );

      const turnOn = doSomething.pipe(
        filter(([_, anyLightOn]) => anyLightOn === false),
        tap(_ => log(`switch on: ${JSON.stringify(_)}`)),
      );

      const cycleNext = doSomething.pipe(
        filter(([_, anyLightOn]) => anyLightOn === true),
        filter(([switched, _]) => switched.interval < 5000),
        tap(_ => log(`switch next: ${JSON.stringify(_)}`)),
      );

      const next = merge(turnOn, cycleNext);

      const turnOff = doSomething.pipe(
        filter(([_, anyLightOn]) => anyLightOn === true),
        filter(([switched, _]) => switched.interval >= 5000),
        tap(_ => log(`switch off: ${JSON.stringify(_)}`)),
      );

      return {
        off: turnOff.pipe(
          map(_ => ({ device: config.device, state: config.cycle.off })),
        ),
        next: next.pipe(
          map(_ => ({ device: config.device, states: config.cycle.on })),
        ),
      };
    }
  }

  export class AqaraWRS_R02 extends Remote {
    constructor(
      config: DeviceConfig &
        CycleDeviceConfig &
        DimmerDeviceConfig &
        MaximumBrightnessSceneDeviceConfig,
    ) {
      super();

      const features: IFeature[] = [];

      if (config.cycle) {
        features.push(new Cycle(this.cycleStreams(config)));
      }

      if (config.dim) {
        features.push(new Dimmer(this.dimmerStreams(config)));
      }

      if (config.max_brightness_scenes) {
        features.push(
          new MaximumBrightnessScene(
            this.maximumBrightnessSceneStreams(config),
          ),
        );
      }

      this.addFeature(...features);
    }

    private cycleStreams(
      config: DeviceConfig & CycleDeviceConfig,
    ): CycleStreams {
      const left = new Observable<string>(observer =>
        on(
          { id: `${config.device}.single_left`, val: true, ack: true },
          event => observer.next(event.id),
        ),
      ).pipe(share());

      const right = new Observable<string>(observer =>
        on(
          { id: `${config.device}.single_right`, val: true, ack: true },
          event => observer.next(event.id),
        ),
      ).pipe(share());

      const lightState = new Observable<iobJS.TypedState>(observer =>
        on({ id: config.cycle.off, ack: true }, event =>
          observer.next(event.state),
        ),
      ).pipe(
        share(),
        startWith(getState(config.cycle.off)),
        // False -> false.
        // Anything else (true and Uncertain, for scenes) -> true.
        map(state => state.val !== false),
        distinctUntilChanged(),
      );

      const turnOn = merge(left, right).pipe(
        withLatestFrom(lightState),
        filter(([_, anyLightOn]) => anyLightOn === false),
        tap(_ => log(`switch on: ${JSON.stringify(_)}`)),
      );

      const cycleNext = right.pipe(
        withLatestFrom(lightState),
        filter(([_, anyLightOn]) => anyLightOn === true),
        tap(_ => log(`switch next: ${JSON.stringify(_)}`)),
      );

      const next = merge(turnOn, cycleNext);

      const turnOff = left.pipe(
        withLatestFrom(lightState),
        filter(([_, anyLightOn]) => anyLightOn === true),
        tap(_ => log(`switch off: ${JSON.stringify(_)}`)),
      );

      return {
        off: turnOff.pipe(
          map(_ => ({ device: config.device, state: config.cycle.off })),
        ),
        next: next.pipe(
          map(_ => ({ device: config.device, states: config.cycle.on })),
        ),
      };
    }

    private dimmerStreams(
      config: DeviceConfig & DimmerDeviceConfig,
    ): DimmerStreams {
      const down = new Observable<iobJS.ChangedStateObject>(observer => {
        on({ id: `${config.device}.double_left`, ack: true }, event => {
          observer.next(event);
        });
      }).pipe(share());

      const up = new Observable<iobJS.ChangedStateObject>(observer => {
        on({ id: `${config.device}.double_right`, ack: true }, event => {
          observer.next(event);
        });
      }).pipe(share());

      const darker = down.pipe(filter(event => event.state.val));
      const brighter = up.pipe(filter(event => event.state.val));
      const stop = merge(down, up).pipe(
        filter(event => !event.state.val),
        delay(200),
      );

      return {
        brightnessChange: config.dim.brightnessChange,
        lights: config.dim.lights,
        darker: darker.pipe(map(_event => config.device)),
        brighter: brighter.pipe(map(_event => config.device)),
        stop: stop.pipe(map(_event => config.device)),
      };
    }

    private maximumBrightnessSceneStreams(
      config: DeviceConfig & MaximumBrightnessSceneDeviceConfig,
    ): MaximumBrightnessSceneStreams {
      const both = new Observable<string>(observer =>
        on(
          { id: `${config.device}.single_both`, val: true, ack: true },
          event => observer.next(event.id),
        ),
      ).pipe(share());

      return {
        turnedOn: both.pipe(
          map(_ => ({
            device: config.device,
            states: config.max_brightness_scenes,
          })),
        ),
      };
    }
  }

  export class TradfriDimmer extends Remote {
    constructor(
      config: DeviceConfig &
        DimmerDeviceConfig &
        CycleDeviceConfigWithDynamicOff,
    ) {
      super();

      const features: IFeature[] = [];

      if (config.cycle) {
        features.push(new Cycle(this.cycleStreams(config)));
      }

      features.push(new Dimmer(this.dimmerStreams(config)));

      this.addFeature(...features);
    }

    private cycleStreams(
      config: DeviceConfig & CycleDeviceConfigWithDynamicOff,
    ): CycleStreams {
      return {
        off: new Observable<iobJS.ChangedStateObject>(observer =>
          on({ id: `${config.device}.off`, ack: true, val: true }, event =>
            observer.next(event),
          ),
        ).pipe(
          map(_event => ({ device: config.device, state: config.cycle.off })),
        ),
        next: new Observable<iobJS.ChangedStateObject>(observer =>
          on({ id: `${config.device}.on`, ack: true, val: true }, event =>
            observer.next(event),
          ),
        ).pipe(
          map(_event => ({ device: config.device, states: config.cycle.on })),
        ),
      };
    }

    private dimmerStreams(
      config: DeviceConfig & DimmerDeviceConfig,
    ): DimmerStreams {
      const release = new Observable<iobJS.ChangedStateObject>(observer =>
        on(
          {
            id: `${config.device}.brightness_stop`,
            ack: true,
            val: true,
          },
          event => observer.next(event),
        ),
      );

      const up_hold = new Observable<iobJS.ChangedStateObject>(observer =>
        on(
          { id: `${config.device}.brightness_move_up`, ack: true, val: true },
          event => observer.next(event),
        ),
      );

      const down_hold = new Observable<iobJS.ChangedStateObject>(observer =>
        on(
          { id: `${config.device}.brightness_move_down`, ack: true, val: true },
          event => observer.next(event),
        ),
      );

      return {
        brightnessChange: config.dim.brightnessChange,
        lights: config.dim.lights,
        darker: down_hold.pipe(map(_event => config.device)),
        brighter: up_hold.pipe(map(_event => config.device)),
        stop: release.pipe(map(_event => config.device)),
      };
    }
  }

  export class Philips extends Remote {
    constructor(
      config: DeviceConfig &
        DimmerDeviceConfig &
        CycleDeviceConfigWithDynamicOff,
    ) {
      super();

      const features: IFeature[] = [];

      if (config.cycle) {
        features.push(new Cycle(this.cycleStreams(config)));
      }

      features.push(new Dimmer(this.dimmerStreams(config)));

      this.addFeature(...features);
    }

    private cycleStreams(
      config: DeviceConfig & CycleDeviceConfigWithDynamicOff,
    ): CycleStreams {
      return {
        off: new Observable<iobJS.ChangedStateObject>(observer =>
          on(
            { id: `${config.device}.off_press_release`, ack: true, val: true },
            event => observer.next(event),
          ),
        ).pipe(
          map(_event => ({ device: config.device, state: config.cycle.off })),
        ),
        next: new Observable<iobJS.ChangedStateObject>(observer =>
          on(
            { id: `${config.device}.on_press_release`, ack: true, val: true },
            event => observer.next(event),
          ),
        ).pipe(
          map(_event => ({ device: config.device, states: config.cycle.on })),
        ),
      };
    }

    private dimmerStreams(
      config: DeviceConfig & DimmerDeviceConfig,
    ): DimmerStreams {
      const down_hold = new Observable<boolean>(observer =>
        on({ id: `${config.device}.down_hold`, ack: true, val: true }, _event =>
          observer.next(true),
        ),
      );

      const down_release = new Observable<boolean>(observer =>
        on(
          {
            id: `${config.device}.down_hold_release`,
            ack: true,
            val: true,
          },
          _event => observer.next(false),
        ),
      ).pipe(take(1));

      const darker = down_hold.pipe(
        exhaustMap(x => concat(of(x), down_release)),
      );

      const up_hold = new Observable<boolean>(observer =>
        on({ id: `${config.device}.up_hold`, ack: true, val: true }, _event =>
          observer.next(true),
        ),
      );

      const up_release = new Observable<boolean>(observer =>
        on(
          {
            id: `${config.device}.up_hold_release`,
            ack: true,
            val: true,
          },
          _event => observer.next(false),
        ),
      ).pipe(take(1));

      const brighter = up_hold.pipe(exhaustMap(x => concat(of(x), up_release)));

      return {
        brightnessChange: config.dim.brightnessChange,
        lights: config.dim.lights,
        darker: darker.pipe(
          filter(x => x === true),
          map(_event => config.device),
        ),
        brighter: brighter.pipe(
          filter(x => x === true),
          map(_event => config.device),
        ),
        stop: merge(darker, brighter).pipe(
          filter(x => x === false),
          map(_event => config.device),
        ),
      };
    }
  }

  export class Shelly extends Remote {
    constructor(config: DeviceConfig & ToggleDeviceConfig & CycleDeviceConfig) {
      super();

      if (config.toggle) {
        this.addFeature(new ToggleAndSwitch(this.toggleStreams(config)));
      }

      if (config.cycle) {
        this.addFeature(new Cycle(this.cycleStreams(config)));
      }
    }

    private toggleStreams(
      config: DeviceConfig & ToggleDeviceConfig,
    ): ToggleAndSwitchStreams {
      const stateChanges = new Observable<iobJS.ChangedStateObject>(observer =>
        on({ id: `${config.device}.POWER`, change: 'ne', ack: true }, event =>
          observer.next(event),
        ),
      ).pipe(share());

      return {
        turnedOn: stateChanges.pipe(
          filter(event => event.state.val === 'ON'),
          map(_event => ({
            device: config.device,
            states: config.toggle.states,
            off: config.toggle.off,
          })),
        ),
        turnedOff: stateChanges.pipe(
          filter(event => event.state.val !== 'ON'),
          map(_event => ({
            device: config.device,
            states: config.toggle.states,
            off: config.toggle.off,
          })),
        ),
      };
    }

    private cycleStreams(
      config: DeviceConfig & CycleDeviceConfig,
    ): CycleStreams {
      const shellySwitched = new Observable<string>(observer =>
        on({ id: `${config.device}.POWER`, ack: true }, event =>
          observer.next(event.id),
        ),
      ).pipe(share());

      const lightState = new Observable<iobJS.TypedState>(observer =>
        on({ id: config.cycle.off, ack: true }, event =>
          observer.next(event.state),
        ),
      ).pipe(
        share(),
        startWith(getState(config.cycle.off)),
        // False -> false.
        // Anything else (true and Uncertain, for scenes) -> true.
        map(state => state.val !== false),
        distinctUntilChanged(),
      );

      const doSomething = shellySwitched.pipe(
        timeInterval(),
        withLatestFrom(lightState),
      );

      const turnOn = doSomething.pipe(
        filter(([_, anyLightOn]) => anyLightOn === false),
        tap(_ => log(`switch on: ${JSON.stringify(_)}`)),
      );

      const cycleNext = doSomething.pipe(
        filter(([_, anyLightOn]) => anyLightOn === true),
        filter(([switched, _]) => switched.interval < 5000),
        tap(_ => log(`switch next: ${JSON.stringify(_)}`)),
      );

      const next = merge(turnOn, cycleNext);

      const turnOff = doSomething.pipe(
        filter(([_, anyLightOn]) => anyLightOn === true),
        filter(([switched, _]) => switched.interval >= 5000),
        tap(_ => log(`switch off: ${JSON.stringify(_)}`)),
      );

      return {
        off: turnOff.pipe(
          map(_ => ({ device: config.device, state: config.cycle.off })),
        ),
        next: next.pipe(
          map(_ => ({ device: config.device, states: config.cycle.on })),
        ),
      };
    }
  }

  interface ObjectsWithStateQueryConfig {
    rooms: string | string[];
    functions: string | string[];
  }

  export class ObjectsWithStateQuery {
    private config: ObjectsWithStateQueryConfig;

    constructor(config: ObjectsWithStateQueryConfig) {
      this.config = config;
    }

    public forEach(
      callbackfn: (value: string, index: number, array: string[]) => void,
      thisArg?: any,
    ): void {
      this.values().forEach(callbackfn, thisArg);
    }

    public map<U>(
      callbackfn: (value: string, index: number, array: string[]) => U,
      thisArg?: any,
    ): U[] {
      return this.values().map(callbackfn, thisArg);
    }

    public values(): string[] {
      const states: string[] = [];

      $(this.query('state.id=*.state')).each(id => {
        states.push(id);
      });

      return states;
    }

    public get length(): number {
      return this.values().length;
    }

    private query(stateQuery: string): string {
      return `channel[${stateQuery}](rooms=${this.config.rooms})(functions=${this.config.functions})`;
    }
  }

  export class DimmableLights {
    private constructor() {}

    static for(...ids: string[]): Observable<string[]> {
      const stateChanges = ids.map(id => {
        const stream = new Observable<{ id: string; val: boolean }>(observer =>
          on({ id: id, ack: true }, event =>
            observer.next({ id: id, val: event.state.val }),
          ),
        ).pipe(share());

        const state = getState(id);
        const initial = { id: id, val: state.val };

        return stream.pipe(startWith(initial));
      });

      return combineLatest(stateChanges, (...stateChanges) =>
        stateChanges
          .filter(x => x.val === true)
          .map(x => x.id)
          .map(id => id.replace(/\.state$/, '')),
      );
    }
  }
}
