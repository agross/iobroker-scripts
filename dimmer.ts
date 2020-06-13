import { Observable, merge } from 'rxjs';
import { filter, debounceTime, tap } from 'rxjs/operators';

const BRIGHTNESS_CHANGE = 5;

abstract class OnOffStrategy implements IFeature {
  public abstract setUp(device: string): void;
}

interface CycleConfig {
  off: string;
  on: string[];
}

class Cycle extends OnOffStrategy {
  private readonly config: CycleConfig;

  constructor(config: CycleConfig) {
    super();
    this.config = config;
  }

  public setUp(device: string): void {
    on({ id: `${device}.state`, ack: true, val: false }, off => {
      log(`${device}: Turning off`);

      setState(this.config.off, false);
    });

    on({ id: `${device}.state`, ack: true, val: true }, on => {
      const currentIndex = this.config.on
        .map(obj => {
          return { object: obj, state: getState(obj) };
        })
        .reduce((acc, state, index) => {
          if (acc < 0 && state.state.val === true) {
            return index;
          }

          return acc;
        }, -1);

      const activate = this.config.on[currentIndex + 1] || this.config.on[0];
      log(`${device}: Cycle next: ${activate}`);

      setState(activate, true);
    });
  }
}

class Toggle extends OnOffStrategy {
  private readonly objects: string[];

  constructor(...objects: string[]) {
    super();
    this.objects = objects;
  }

  public setUp(device: string): void {
    on({ id: `${device}.state`, ack: true }, event => {
      this.objects.forEach(obj => setState(obj, event.state.val));
    });
  }
}

interface RemoteConfig {
  device: string;
}

abstract class Remote {
  private readonly features: IFeature[] = [];
  private readonly config: RemoteConfig;

  constructor(config: RemoteConfig) {
    this.config = config;
  }

  public setUp(): void {
    this.features.forEach(f => f.setUp(this.config.device));
  }

  protected addFeature(...feature: IFeature[]): void {
    feature.forEach(feature => this.features.push(feature));
  }
}

interface IFeature {
  setUp(device: string): void;
}

interface DimmerConfig {
  brightnessChange: number;
  lights: string[] | DimmableLights;
  brighter: (
    device: string,
    cb: (event: iobJS.ChangedStateObject) => any,
  ) => void;
  darker: (
    device: string,
    cb: (event: iobJS.ChangedStateObject) => any,
  ) => void;
  stop: (device: string, cb: (event: iobJS.ChangedStateObject) => any) => void;
}

class Dimmer implements IFeature {
  readonly config: DimmerConfig;

  constructor(config: DimmerConfig) {
    this.config = config;
  }

  setUp(device: string): void {
    let interval = undefined;

    this.config.darker(device, _event => {
      if (!interval) {
        log(`Starting ${device} darker dimmer`);

        this.config.lights.forEach(light => {
          setState(`${light}.transition_time`, 0.2);
        });

        interval = setInterval(() => this.makeDarker(), 200);
      }
    });

    this.config.brighter(device, _event => {
      if (!interval) {
        log(`Starting ${device} brighter dimmer`);

        this.config.lights.forEach(light => {
          setState(`${light}.transition_time`, 0.2);
        });

        interval = setInterval(() => this.makeBrighter(), 200);
      }
    });

    this.config.stop(device, _event => {
      if (interval) {
        log(`Stopping ${device} dimmer`);

        clearInterval(interval);
        interval = undefined;

        this.config.lights.forEach(light => {
          setState(`${light}.transition_time`, 3);
        });
      }
    });
  }

  private makeDarker() {
    this.changeBrightness(
      (ref, brightness) => brightness < (ref || Infinity),
      brightness => brightness - this.config.brightnessChange,
    );
  }

  private makeBrighter() {
    this.changeBrightness(
      (ref, brightness) => brightness > (ref || -Infinity),
      brightness => brightness + this.config.brightnessChange,
    );
  }

  private changeBrightness(
    selector: (reference: number, brightness: number) => boolean,
    newBrightness: (brightness: number) => number,
  ) {
    const brightnesses = this.config.lights.map(light => `${light}.brightness`);

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
    if (brightness < 0) {
      brightness = 0;
    }
    if (brightness > 100) {
      brightness = 100;
    }

    log(`Setting brightness ${brightness}`);
    brightnesses.forEach(b => setState(b, brightness));
  }
}

interface DimConfig {
  brightnessChange: number;
  lights: string[] | DimmableLights;
}

interface CycleConfig {
  off: string;
  on: string[];
}

interface OnOffDimRemoteConfig extends RemoteConfig {
  dim: DimConfig;
  on_off: OnOffStrategy;
}

class Tradfi extends Remote {
  constructor(config: OnOffDimRemoteConfig) {
    super(config);

    this.addFeature(
      config.on_off,
      new Dimmer({
        lights: config.dim.lights,
        brightnessChange: config.dim.brightnessChange,
        brighter: (device, cb) => this.brighter(device, cb),
        darker: (device, cb) => this.darker(device, cb),
        stop: (device, cb) => this.stop(device, cb),
      }),
    );
  }

  private darker(device: string, cb: (event: iobJS.ChangedStateObject) => any) {
    on({ id: `${device}.down_button`, val: true, ack: true }, event =>
      cb(event),
    );
  }

  private brighter(
    device: string,
    cb: (event: iobJS.ChangedStateObject) => any,
  ) {
    on({ id: `${device}.up_button`, val: true, ack: true }, event => cb(event));
  }

  private stop(device: string, cb: (event: iobJS.ChangedStateObject) => any) {
    on({ id: `${device}.down_button`, val: false, ack: true }, event =>
      cb(event),
    );
    on({ id: `${device}.up_button`, val: false, ack: true }, event =>
      cb(event),
    );
  }
}

class Philips extends Remote {
  private _up_hold: Observable<iobJS.ChangedStateObject>;
  private _down_hold: Observable<iobJS.ChangedStateObject>;

  constructor(config: OnOffDimRemoteConfig) {
    super(config);

    this.addFeature(
      config.on_off,
      new Dimmer({
        lights: config.dim.lights,
        brightnessChange: config.dim.brightnessChange,
        brighter: (device, cb) => this.brighter(device, cb),
        darker: (device, cb) => this.darker(device, cb),
        stop: (device, cb) => this.stop(device, cb),
      }),
    );
  }

  private darker(device: string, cb: (event: iobJS.ChangedStateObject) => any) {
    this.down_hold(device)
      .pipe(
        filter((event: iobJS.ChangedStateObject) => event.state.val === true),
        tap((event: iobJS.ChangedStateObject) => cb(event)),
      )
      .subscribe();
  }

  private brighter(
    device: string,
    cb: (event: iobJS.ChangedStateObject) => any,
  ) {
    this.up_hold(device)
      .pipe(
        filter((event: iobJS.ChangedStateObject) => event.state.val === true),
        tap((event: iobJS.ChangedStateObject) => cb(event)),
      )
      .subscribe();
  }

  private stop(device: string, cb: (event: iobJS.ChangedStateObject) => any) {
    merge(this.down_hold(device), this.up_hold(device))
      .pipe(
        filter((event: iobJS.ChangedStateObject) => event.state.val === false),
        debounceTime(900),
        tap(event => cb(event)),
      )
      .subscribe();
  }

  private down_hold(device: string) {
    if (this._down_hold) {
      return this._down_hold;
    }

    this._down_hold = new Observable(observer => {
      on({ id: `${device}.down_hold`, ack: true }, event => {
        observer.next(event);
      });
    });

    return this._down_hold;
  }

  private up_hold(device: string) {
    if (this._up_hold) {
      return this._up_hold;
    }

    this._up_hold = new Observable(observer => {
      on({ id: `${device}.up_hold`, ack: true }, event => {
        observer.next(event);
      });
    });

    return this._up_hold;
  }
}

interface DimmableLightsConfig {
  rooms: string | string[];
  functions: string | string[];
}

class DimmableLights {
  private config: DimmableLightsConfig;

  constructor(config: DimmableLightsConfig) {
    this.config = config;
  }

  forEach(
    callbackfn: (value: string, index: number, array: string[]) => void,
    thisArg?: any,
  ): void {
    this.toArray().forEach(callbackfn, thisArg);
  }

  map<U>(
    callbackfn: (value: string, index: number, array: string[]) => U,
    thisArg?: any,
  ): U[] {
    return this.toArray().map(callbackfn, thisArg);
  }

  toArray(): string[] {
    const states: {
      source: string;
      state: iobJS.AbsentState | iobJS.State;
    }[] = [];

    $(this.query('state.id=*.state')).each(id => {
      states.push({ source: id, state: getState(id) });
    });

    const objectIdFromStateId = function (id: string) {
      return id.replace(/\.state$/, '');
    };

    const hasTransitionTime = function (id: string) {
      return existsState(id + '.transition_time');
    };
    const hasBrightness = function (id: string) {
      return existsState(id + '.brightness');
    };

    const turnedOn = states
      .filter(x => !x.state.notExist)
      .filter(x => x.state.val === true)
      .map(x => x.source)
      .map(id => objectIdFromStateId(id))
      .filter(object => hasTransitionTime(object))
      .filter(object => hasBrightness(object));

    return turnedOn;
  }

  private query(stateQuery: string): string {
    return `channel[${stateQuery}](rooms=${this.config.rooms})(functions=${this.config.functions})`;
  }
}

const remotes = [
  new Tradfi({
    device: 'zigbee.0.588e81fffe2bacf4', // Kitchen TRADFRI on/off switch
    dim: {
      brightnessChange: BRIGHTNESS_CHANGE,
      lights: new DimmableLights({ rooms: 'Kitchen', functions: 'funcLight' }),
    },
    on_off: new Cycle({
      off: 'scene.0.Kitchen_Lights',
      on: [
        'scene.0.Kitchen_Lights_Low',
        'scene.0.Kitchen_Lights_Downlight',
        'scene.0.Kitchen_Lights_Downlight_+_Dining',
        'scene.0.Kitchen_Lights_Downlight_+_Kitchen',
        'scene.0.Kitchen_Lights_Bright',
      ],
    }),
  }),
  new Tradfi({
    // Bedroom TRADFRI on/off switch
    device: 'zigbee.0.588e81fffe17a8ca',
    dim: {
      brightnessChange: BRIGHTNESS_CHANGE,
      lights: new DimmableLights({ rooms: 'Bedroom', functions: 'funcLight' }),
    },
    on_off: new Toggle(
      'zigbee.0.0017880108376b6c.state', // Bedroom Philips Hue LCA001
    ),
  }),
  new Philips({
    // Hue Remote RWL021
    device: 'zigbee.0.001788010872fbc4',
    dim: {
      brightnessChange: BRIGHTNESS_CHANGE,
      lights: new DimmableLights({
        rooms: 'Living Room',
        functions: 'funcLight',
      }),
    },
    on_off: new Cycle({
      off: 'scene.0.Living_Room_Lights',
      on: [
        'scene.0.Living_Room_Lights_Bright',
        'scene.0.Living_Room_Lights_TV',
      ],
    }),
  }),
];

remotes.forEach(remote => remote.setUp());
