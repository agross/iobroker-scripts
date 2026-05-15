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
    type State = string | (() => string);
    type States = string[] | (() => string[]);

    type CycleConfig = {
      off: State;
      on: States;
    };

    type ToggleConfig = {
      off?: States;
      states: States;
    };

    type DimmerConfig = {
      brightnessChange: number;
      lights: Observable<string[]>;
    };

    type DeviceConfig = {
      device: string;
    };

    type DimmerDeviceConfig = {
      dim?: DimmerConfig;
    };

    type ToggleDeviceConfig = {
      toggle: ToggleConfig;
    };

    type CycleDeviceConfig = {
      cycle: CycleConfig;
    };

    type MaximumBrightnessSceneDeviceConfig = {
      max_brightness_scenes?: string[];
    };

    abstract class Remote {
      setUp(): Subscription;
    }

    class AqaraWS_EUK03 extends Remote {
      constructor(
        config: DeviceConfig & (ToggleDeviceConfig | CycleDeviceConfig),
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
          (ToggleDeviceConfig | CycleDeviceConfig),
      );
    }

    class Philips extends Remote {
      constructor(
        config: DeviceConfig &
          DimmerDeviceConfig &
          (ToggleDeviceConfig | CycleDeviceConfig),
      );
    }

    class Shelly extends Remote {
      constructor(
        config: DeviceConfig & (ToggleDeviceConfig | CycleDeviceConfig),
      );
    }

    class DimmableLights {
      static for(config: {
        room: string;
        function: string;
      }): Observable<string[]>;
    }
  }
}

export namespace Remotes {
  interface IFeature {
    setUp(): Subscription;
  }

  type State = string | (() => string);

  type States =
    | string
    | readonly string[]
    | (() => string)
    | (() => readonly string[]);

  function isStringArray(
    value: string | readonly string[],
  ): value is readonly string[] {
    return Array.isArray(value);
  }

  function resolveState(state: State): string {
    return typeof state === 'function' ? state() : state;
  }
  function resolveStates(states?: States): string[] {
    if (!states) return [];

    const value = typeof states === 'function' ? states() : states;

    return isStringArray(value) ? [...value] : [value];
  }

  interface CycleConfig {
    off: State;
    on: States;
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
          const resolvedOff = resolveState(state);

          log(`${device}: Turned off`);

          setState(resolvedOff, false);
        }),
      );

      const next = this.config.next.pipe(
        tap(({ device, states }) => {
          const resolvedStates = resolveStates(states);

          const currentIndex = resolvedStates
            .map(state => ({ object: state, state: getState(state) }))
            .reduce((acc, state, index) => {
              if (acc < 0 && state.state.val === true) {
                return index;
              }

              return acc;
            }, -1);

          const activate =
            resolvedStates[currentIndex + 1] || resolvedStates[0];
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

          anyOnDeterminedBy = resolveStates(anyOnDeterminedBy);

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
          const resolvedStates = resolveStates(states);

          log(
            `${device}: None on. Setting true for ${JSON.stringify(resolvedStates)}`,
          );

          resolvedStates.forEach(state => setState(state, true));
        }),
      );

      const someOn = toggled.pipe(filter(x => x.anyOn));

      const explicitOffTurnedOff = someOn.pipe(
        tap(({ device, states, off, anyOn }) => {
          if (!off) {
            return;
          }
          const resolvedOff = resolveStates(off);
          log(
            `${device}: Explicit off. Setting false for ${JSON.stringify(resolvedOff)}`,
          );

          resolvedOff.forEach(state => setState(state, false));
        }),
      );

      const implicitOffTurnedOff = someOn.pipe(
        filter(x => !x.off),
        tap(({ device, states, off, anyOn }) => {
          const resolvedStates = resolveStates(states);

          log(
            `${device}: Implicit off. Setting false for ${JSON.stringify(
              resolvedStates,
            )}`,
          );

          resolvedStates.forEach(state => setState(state, false));
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
            const resolvedStates = resolveStates(states);

            log(
              `${device}: Setting true for ${JSON.stringify(resolvedStates)}`,
            );

            resolvedStates.forEach(state => setState(state, true));
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
  }

  interface DeviceConfig {
    device: string;
  }

  interface DimmerDeviceConfig {
    dim?: DimmerConfig;
  }

  type ToggleDeviceConfig = {
    toggle: ToggleConfig;
  };

  type CycleDeviceConfig = {
    cycle: CycleConfig;
  };

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
        (ToggleDeviceConfig | CycleDeviceConfig) &
        MaximumBrightnessSceneDeviceConfig,
    ) {
      super();

      const features: IFeature[] = [];

      if ('toggle' in config) {
        features.push(new ToggleAndSwitch(this.toggleStreams(config)));
      }

      if ('cycle' in config) {
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

      const resolvedOff = resolveState(config.cycle.off);

      const lightState = new Observable<iobJS.TypedState>(observer => {
        on({ id: resolvedOff, ack: true }, event => observer.next(event.state));
      }).pipe(
        share(),
        startWith(getState(resolvedOff)),
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

      features.push(new Cycle(this.cycleStreams(config)));

      if (config.dim) {
        features.push(new Dimmer(this.dimmerStreams(config, config.dim)));
      }

      if (config.max_brightness_scenes) {
        features.push(
          new MaximumBrightnessScene(
            this.maximumBrightnessSceneStreams(
              config,
              config.max_brightness_scenes,
            ),
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

      const resolvedOff = resolveState(config.cycle.off);

      const lightState = new Observable<iobJS.TypedState>(observer =>
        on({ id: resolvedOff, ack: true }, event => observer.next(event.state)),
      ).pipe(
        share(),
        startWith(getState(resolvedOff)),
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
      config: DeviceConfig,
      dim: DimmerConfig,
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
        brightnessChange: dim.brightnessChange,
        lights: dim.lights,
        darker: darker.pipe(map(_event => config.device)),
        brighter: brighter.pipe(map(_event => config.device)),
        stop: stop.pipe(map(_event => config.device)),
      };
    }

    private maximumBrightnessSceneStreams(
      config: DeviceConfig,
      scenes: string[],
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
            states: scenes,
          })),
        ),
      };
    }
  }

  export class TradfriDimmer extends Remote {
    constructor(config: DeviceConfig & DimmerDeviceConfig & CycleDeviceConfig) {
      super();

      const features: IFeature[] = [];

      features.push(new Cycle(this.cycleStreams(config)));

      if (config.dim) {
        features.push(new Dimmer(this.dimmerStreams(config, config.dim)));
      }

      this.addFeature(...features);
    }

    private cycleStreams(
      config: DeviceConfig & CycleDeviceConfig,
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
      config: DeviceConfig,
      dim: DimmerConfig,
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
        brightnessChange: dim.brightnessChange,
        lights: dim.lights,
        darker: down_hold.pipe(map(_event => config.device)),
        brighter: up_hold.pipe(map(_event => config.device)),
        stop: release.pipe(map(_event => config.device)),
      };
    }
  }

  export class Philips extends Remote {
    constructor(config: DeviceConfig & DimmerDeviceConfig & CycleDeviceConfig) {
      super();

      const features: IFeature[] = [];

      if (config.cycle) {
        features.push(new Cycle(this.cycleStreams(config, config.cycle)));
      }

      if (config.dim) {
        features.push(new Dimmer(this.dimmerStreams(config, config.dim)));
      }

      this.addFeature(...features);
    }

    private cycleStreams(
      config: DeviceConfig,
      cycle: CycleConfig,
    ): CycleStreams {
      return {
        off: new Observable<iobJS.ChangedStateObject>(observer =>
          on(
            { id: `${config.device}.off_press_release`, ack: true, val: true },
            event => observer.next(event),
          ),
        ).pipe(map(_event => ({ device: config.device, state: cycle.off }))),
        next: new Observable<iobJS.ChangedStateObject>(observer =>
          on(
            { id: `${config.device}.on_press_release`, ack: true, val: true },
            event => observer.next(event),
          ),
        ).pipe(map(_event => ({ device: config.device, states: cycle.on }))),
      };
    }

    private dimmerStreams(
      config: DeviceConfig,
      dim: DimmerConfig,
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
        brightnessChange: dim.brightnessChange,
        lights: dim.lights,
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
    constructor(
      config: DeviceConfig & (ToggleDeviceConfig | CycleDeviceConfig),
    ) {
      super();

      if ('toggle' in config) {
        this.addFeature(new ToggleAndSwitch(this.toggleStreams(config)));
      }

      if ('cycle' in config) {
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

      const resolvedOff = resolveState(config.cycle.off);

      const lightState = new Observable<iobJS.TypedState>(observer =>
        on({ id: resolvedOff, ack: true }, event => observer.next(event.state)),
      ).pipe(
        share(),
        startWith(getState(resolvedOff)),
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

  export class DimmableLights {
    private constructor() {}

    static for(config: {
      room: string;
      function: string;
    }): Observable<string[]> {
      const selector = `channel[state.id=*.state](rooms=${config.room})(functions=${config.function})`;

      const ids = [...$(selector)];
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

      return combineLatest(stateChanges).pipe(
        map(stateChanges =>
          stateChanges
            .filter(x => x.val === true)
            .map(x => x.id)
            .map(id => id.replace(/\.state$/, '')),
        ),
      );
    }
  }
}
