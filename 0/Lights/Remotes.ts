import { Observable, merge, combineLatest, Subscription } from 'rxjs';
import {
  filter,
  debounceTime,
  map,
  startWith,
  withLatestFrom,
  distinctUntilChanged,
  timeInterval,
  share,
  tap,
} from 'rxjs/operators';

const BRIGHTNESS_CHANGE = 5;

interface IFeature {
  setUp(): Subscription;
}

type States = string[] | ObjectsWithStateQuery;

interface CycleConfig {
  off: string;
  on: string[];
}

interface CycleStreams {
  off: Observable<{ device: string; state: string }>;
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
        log(`${device}: Turned off`);

        setState(state, false);
      }),
    );

    const next = this.config.next.pipe(
      tap(({ device, states }) => {
        const currentIndex = states
          .map(obj => {
            return { object: obj, state: getState(obj) };
          })
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

interface ToggleAndFollowRemoteStreams {
  turnedOn: Observable<{ device: string; states: States }>;
  turnedOff: Observable<{ device: string; states: States }>;
}

interface ToggleAndSwitchStreams {
  turnedOn: Observable<{ device: string; states: States; off?: States }>;
  turnedOff: Observable<{ device: string; states: States; off?: States }>;
}

// The state is determined by the stateful remote.
class ToggleAndFollowRemoteState implements IFeature {
  private readonly config: ToggleAndFollowRemoteStreams;

  constructor(config: ToggleAndFollowRemoteStreams) {
    this.config = config;
  }

  public setUp(): Subscription {
    const on = this.config.turnedOn.pipe(
      tap(({ device, states }) => {
        log(`${device}: Turned on. States to set: ${JSON.stringify(states)}`);

        states.forEach(state => setState(state, true));
      }),
    );

    const off = this.config.turnedOff.pipe(
      tap(({ device, states }) => {
        log(`${device}: Turned off. States to set: ${JSON.stringify(states)}`);

        states.forEach(state => setState(state, false));
      }),
    );

    return [on, off].reduce((acc, $) => {
      acc.add($.subscribe());
      return acc;
    }, new Subscription());
  }
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
        const anyOnDeterminedBy = off || states;

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
        log(`${device}: None on. Setting true for ${JSON.stringify(states)}`);

        states.forEach(state => setState(state, true));
      }),
    );

    const someOn = toggled.pipe(filter(x => x.anyOn));

    const explicitOffTurnedOff = someOn.pipe(
      filter(x => !!x.off),
      tap(({ device, states, off, anyOn }) => {
        log(
          `${device}: Explicit off. Setting false for ${JSON.stringify(off)}`,
        );

        off.forEach(state => setState(state, false));
      }),
    );

    const implicitOffTurnedOff = someOn.pipe(
      filter(x => !x.off),
      tap(({ device, states, off, anyOn }) => {
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
    let interval = undefined;

    const darker = this.config.darker
      .pipe(withLatestFrom(this.config.lights))
      .pipe(
        tap(([device, states]) => {
          if (!interval) {
            log(`${device}: Starting darker dimmer`);

            states.forEach(light => {
              setState(`${light}.transition_time`, 0.2);
            });

            interval = setInterval(() => this.makeDarker(states), 200);
          }
        }),
      );

    const brighter = this.config.brighter
      .pipe(withLatestFrom(this.config.lights))
      .pipe(
        tap(([device, states]) => {
          if (!interval) {
            log(`${device}: Starting brighter dimmer`);

            states.forEach(light => {
              setState(`${light}.transition_time`, 0.2);
            });

            interval = setInterval(() => this.makeBrighter(states), 200);
          }
        }),
      );

    const stop = this.config.stop.pipe(withLatestFrom(this.config.lights)).pipe(
      tap(([device, states]) => {
        if (interval) {
          log(`Stopping ${device} dimmer`);

          clearInterval(interval);
          interval = undefined;

          states.forEach(light => {
            setState(`${light}.transition_time`, 3);
          });
        }
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
    const brightnesses = states.map(light => `${light}.brightness`);

    const minBrightness = brightnesses
      .map(stateId => ({ source: stateId, state: getState(stateId) }))
      .filter(state => !state.state.notExist)
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

class Tradfi extends Remote {
  constructor(
    config: DeviceConfig &
      DimmerDeviceConfig &
      ToggleDeviceConfig &
      CycleDeviceConfig,
  ) {
    super();

    const features: IFeature[] = [];

    if (config.toggle) {
      features.push(new ToggleAndFollowRemoteState(this.toggleStreams(config)));
    }

    if (config.cycle) {
      features.push(new Cycle(this.cycleStreams(config)));
    }

    features.push(new Dimmer(this.dimmerStreams(config)));

    this.addFeature(...features);
  }

  private toggleStreams(
    config: DeviceConfig & ToggleDeviceConfig,
  ): ToggleAndFollowRemoteStreams {
    const stateChanges = new Observable<iobJS.ChangedStateObject>(observer => {
      on({ id: `${config.device}.state`, ack: true }, event => {
        observer.next(event);
      });
    }).pipe(share());

    return {
      turnedOn: stateChanges.pipe(
        filter(event => event.state.val),
        map(_event => {
          return {
            device: config.device,
            states: config.toggle.states,
          };
        }),
      ),
      turnedOff: stateChanges.pipe(
        filter(event => !event.state.val),
        map(_event => {
          return {
            device: config.device,
            states: config.toggle.states,
          };
        }),
      ),
    };
  }

  private cycleStreams(config: DeviceConfig & CycleDeviceConfig): CycleStreams {
    const stateChanges = new Observable<iobJS.ChangedStateObject>(observer => {
      on({ id: `${config.device}.state`, ack: true }, event => {
        observer.next(event);
      });
    }).pipe(share());

    return {
      off: stateChanges.pipe(
        filter(event => !event.state.val),
        map(_event => {
          return { device: config.device, state: config.cycle.off };
        }),
      ),
      next: stateChanges.pipe(
        filter(event => event.state.val),
        map(_event => {
          return { device: config.device, states: config.cycle.on };
        }),
      ),
    };
  }

  private dimmerStreams(
    config: DeviceConfig & DimmerDeviceConfig,
  ): DimmerStreams {
    const down = new Observable<iobJS.ChangedStateObject>(observer => {
      on({ id: `${config.device}.down_button`, ack: true }, event => {
        observer.next(event);
      });
    }).pipe(share());

    const up = new Observable<iobJS.ChangedStateObject>(observer => {
      on({ id: `${config.device}.up_button`, ack: true }, event => {
        observer.next(event);
      });
    }).pipe(share());

    const darker = down.pipe(filter(event => event.state.val));
    const brighter = up.pipe(filter(event => event.state.val));
    const stop = merge(down, up).pipe(filter(event => !event.state.val));

    return {
      brightnessChange: config.dim.brightnessChange,
      lights: config.dim.lights,
      darker: darker.pipe(map(_event => config.device)),
      brighter: brighter.pipe(map(_event => config.device)),
      stop: stop.pipe(map(_event => config.device)),
    };
  }
}

class Philips extends Remote {
  constructor(
    config: DeviceConfig &
      DimmerDeviceConfig &
      ToggleDeviceConfig &
      CycleDeviceConfig,
  ) {
    super();

    const features: IFeature[] = [];

    if (config.toggle) {
      features.push(new ToggleAndFollowRemoteState(this.toggleStreams(config)));
    }

    if (config.cycle) {
      features.push(new Cycle(this.cycleStreams(config)));
    }

    features.push(new Dimmer(this.dimmerStreams(config)));

    this.addFeature(...features);
  }

  private toggleStreams(
    config: DeviceConfig & ToggleDeviceConfig,
  ): ToggleAndFollowRemoteStreams {
    const stateChanges = new Observable<iobJS.ChangedStateObject>(observer => {
      on({ id: `${config.device}.state`, change: 'ne', ack: true }, event => {
        observer.next(event);
      });
    }).pipe(share());

    return {
      turnedOn: stateChanges.pipe(
        filter(event => event.state.val),
        map(_event => {
          return { device: config.device, states: config.toggle.states };
        }),
      ),
      turnedOff: stateChanges.pipe(
        filter(event => !event.state.val),
        map(_event => {
          return { device: config.device, states: config.toggle.states };
        }),
      ),
    };
  }

  private cycleStreams(config: DeviceConfig & CycleDeviceConfig): CycleStreams {
    return {
      off: new Observable<iobJS.ChangedStateObject>(observer => {
        on({ id: `${config.device}.state`, ack: true, val: false }, event => {
          observer.next(event);
        });
      }).pipe(
        map(_event => {
          return { device: config.device, state: config.cycle.off };
        }),
      ),
      next: new Observable<iobJS.ChangedStateObject>(observer => {
        on({ id: `${config.device}.state`, ack: true, val: true }, event => {
          observer.next(event);
        });
      }).pipe(
        map(_event => {
          return { device: config.device, states: config.cycle.on };
        }),
      ),
    };
  }

  private dimmerStreams(
    config: DeviceConfig & DimmerDeviceConfig,
  ): DimmerStreams {
    const down_hold = new Observable<iobJS.ChangedStateObject>(observer => {
      on({ id: `${config.device}.down_hold`, ack: true }, event => {
        observer.next(event);
      });
    }).pipe(share());

    const up_hold = new Observable<iobJS.ChangedStateObject>(observer => {
      on({ id: `${config.device}.up_hold`, ack: true }, event => {
        observer.next(event);
      });
    }).pipe(share());

    const darker = down_hold.pipe(filter(event => event.state.val));
    const brighter = up_hold.pipe(filter(event => event.state.val));

    const stop = merge(down_hold, up_hold).pipe(
      filter(event => event.state.val === false),
      debounceTime(900),
    );

    return {
      brightnessChange: config.dim.brightnessChange,
      lights: config.dim.lights,
      darker: darker.pipe(map(_event => config.device)),
      brighter: brighter.pipe(map(_event => config.device)),
      stop: stop.pipe(map(_event => config.device)),
    };
  }
}

class Shelly extends Remote {
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
    const stateChanges = new Observable<iobJS.ChangedStateObject>(observer => {
      on({ id: `${config.device}.POWER`, change: 'ne', ack: true }, event => {
        observer.next(event);
      });
    }).pipe(share());

    return {
      turnedOn: stateChanges.pipe(
        filter(event => event.state.val === 'ON'),
        map(_event => {
          return {
            device: config.device,
            states: config.toggle.states,
            off: config.toggle.off,
          };
        }),
      ),
      turnedOff: stateChanges.pipe(
        filter(event => event.state.val !== 'ON'),
        map(_event => {
          return {
            device: config.device,
            states: config.toggle.states,
            off: config.toggle.off,
          };
        }),
      ),
    };
  }

  private cycleStreams(config: DeviceConfig & CycleDeviceConfig): CycleStreams {
    const shellySwitched = new Observable<string>(observer => {
      on({ id: `${config.device}.POWER`, ack: true }, event => {
        observer.next(event.id);
      });
    }).pipe(share());

    const lightState = new Observable<iobJS.State>(observer => {
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
        map(_ => {
          return { device: config.device, state: config.cycle.off };
        }),
      ),
      next: next.pipe(
        map(_ => {
          return { device: config.device, states: config.cycle.on };
        }),
      ),
    };
  }
}

interface ObjectsWithStateQueryConfig {
  rooms: string | string[];
  functions: string | string[];
}

class ObjectsWithStateQuery {
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

class DimmableLights {
  private constructor() {}

  static for(...ids: string[]): Observable<string[]> {
    const stateChanges = ids.map(id => {
      const stream = new Observable<{ id: string; val: boolean }>(observer => {
        on({ id: id, ack: true }, event => {
          observer.next({ id: id, val: event.state.val });
        });
      }).pipe(share());

      const state = getState(id);
      const initial = { id: id, val: state.val };

      return stream.pipe(startWith(initial));
    });

    return combineLatest(stateChanges, (...stateChanges) => {
      return stateChanges
        .filter(x => x.val === true)
        .map(x => x.id)
        .map(id => id.replace(/\.state$/, ''));
    });
  }
}

const remotes = [
  new Tradfi({
    // Kitchen TRADFRI on/off switch
    device: 'zigbee.1.588e81fffe2bacf4',
    dim: {
      brightnessChange: BRIGHTNESS_CHANGE,
      lights: DimmableLights.for(
        ...new ObjectsWithStateQuery({
          rooms: 'Kitchen',
          functions: 'funcLight',
        }).values(),
      ),
    },
    cycle: {
      off: 'scene.0.Kitchen.Lights',
      on: [
        'scene.0.Kitchen.Lights_Low',
        'scene.0.Kitchen.Lights_Downlight',
        'scene.0.Kitchen.Lights_Downlight_+_Dining',
        'scene.0.Kitchen.Lights_Downlight_+_Kitchen',
        'scene.0.Kitchen.Lights_Bright',
      ],
    },
  }),
  new Tradfi({
    // Bedroom TRADFRI on/off switch
    device: 'zigbee.1.588e81fffe17a8ca',
    dim: {
      brightnessChange: BRIGHTNESS_CHANGE,
      lights: DimmableLights.for(
        ...new ObjectsWithStateQuery({
          rooms: 'Bedroom',
          functions: 'funcLight',
        }).values(),
      ),
    },
    cycle: {
      off: 'scene.0.Lights.In_Bed',
      on: [
        'scene.0.Bedroom.Lights_Bright',
        'scene.0.Bedroom.Lights_Low',
        'scene.0.Bedroom.Lights_Cozy',
      ],
    },
  }),
  new Philips({
    // Hue Remote RWL021
    device: 'zigbee.1.001788010872fbc4',
    dim: {
      brightnessChange: BRIGHTNESS_CHANGE,
      lights: DimmableLights.for(
        ...new ObjectsWithStateQuery({
          rooms: 'Living Room',
          functions: 'funcLight',
        }).values(),
      ),
    },
    cycle: {
      off: 'scene.0.Living Room.Lights',
      on: [
        'scene.0.Living Room.Lights_Cozy',
        'scene.0.Living Room.Lights_TV',
        'scene.0.Living Room.Lights_Reading',
        'scene.0.Living Room.Lights_Bright',
      ],
    },
  }),
  new Shelly({
    device: 'mqtt.0.home.office.power.stat.shelly1-4',
    cycle: {
      off: 'scene.0.Office.Lights',
      on: [
        'scene.0.Office.Lights_Cozy',
        'scene.0.Office.Lights_Low',
        'scene.0.Office.Lights_Bright',
      ],
    },
  }),
  new Shelly({
    device: 'mqtt.0.home.utility-room.power.stat.shelly1-1',
    toggle: {
      states: ['scene.0.Utility Room.Entered'],
    },
  }),
  new Shelly({
    device: 'mqtt.0.home.bedroom.power.stat.shelly1-2',
    cycle: {
      off: 'scene.0.Bedroom.Lights',
      on: [
        'scene.0.Bedroom.Lights_Bright',
        'scene.0.Bedroom.Lights_Low',
        'scene.0.Bedroom.Lights_Cozy',
      ],
    },
  }),
  new Shelly({
    device: 'mqtt.0.home.hall.power.stat.shelly1-3',
    toggle: {
      off: ['scene.0.Bathroom.Lights'],
      states: ['scene.0.Bathroom.Lights_Bright'],
    },
  }),
  new Shelly({
    device: 'mqtt.0.home.hall.power.stat.shelly1-8',
    toggle: { states: ['scene.0.Leaving_Home'] },
  }),
  new Shelly({
    device: 'mqtt.0.home.hall.power.stat.shelly1-7',
    toggle: {
      off: ['scene.0.Kitchen.Lights'],
      states: ['scene.0.Kitchen.Lights_Bright'],
    },
  }),
  new Shelly({
    device: 'mqtt.0.home.kitchen.power.stat.shelly1-9',
    toggle: {
      off: ['scene.0.Kitchen.Lights'],
      states: ['scene.0.Kitchen.Lights_Bright'],
    },
  }),
  new Shelly({
    device: 'mqtt.0.home.living-room.power.stat.shelly1-5',
    toggle: {
      off: ['scene.0.Living Room.Lights'],
      states: ['scene.0.Living Room.Lights_Bright'],
    },
  }),
  new Shelly({
    device: 'mqtt.0.home.hall.power.stat.shelly1-6',
    toggle: {
      off: ['scene.0.Hall.Lights'],
      states: ['scene.0.Hall.Lights_Bright'],
    },
  }),
  new Shelly({
    device: 'mqtt.0.home.kitchen.power.stat.shelly1-10',
    toggle: {
      off: ['scene.0.Living Room.Lights'],
      states: ['scene.0.Living Room.Lights_Bright'],
    },
  }),
];

const subscriptions = remotes.map(remote => remote.setUp());

onStop(() => {
  subscriptions.forEach(subscription => subscription.unsubscribe());
});
