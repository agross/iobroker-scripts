import { Observable, merge } from 'rxjs';
import { filter, debounceTime, tap } from 'rxjs/operators';

const BRIGHTNESS_CHANGE = 5;

abstract class OnOffStrategy {
  public abstract setUp(config: Config): void;
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

  public setUp(config: Config): void {
    on({ id: `${config.device}.state`, ack: true, val: false }, off => {
      setState(this.config.off, false);
    });

    on({ id: `${config.device}.state`, ack: true, val: true }, on => {
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
      log(`Cycle next: ${activate}`);

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

  public setUp(config: Config): void {
    on({ id: `${config.device}.state`, ack: true }, event => {
      this.objects.forEach(obj => setState(obj, event.state.val));
    });
  }
}

interface Config {
  device: string;
  change: number;
  lights: string[];
  on_off?: OnOffStrategy;
}

abstract class Driver {
  protected readonly config: Config;

  constructor(args: Config) {
    this.config = args;
  }

  protected abstract darker(cb: (event: iobJS.ChangedStateObject) => any): void;
  protected abstract brighter(
    cb: (event: iobJS.ChangedStateObject) => any,
  ): void;
  protected abstract stop(cb: (event: iobJS.ChangedStateObject) => any): void;

  public setUp(): void {
    const darker = () =>
      this.dim(
        (ref, brightness) => brightness < (ref || Infinity),
        brightness => brightness - this.config.change,
      );
    const brighter = () =>
      this.dim(
        (ref, brightness) => brightness > (ref || -Infinity),
        brightness => brightness + this.config.change,
      );

    let interval = undefined;

    this.darker(_event => {
      if (!interval) {
        log(`Starting ${this.config.device} darker dimmer`);
        this.config.lights.forEach(light => {
          setState(`${light}.transition_time`, 0.2);
        });
        interval = setInterval(darker, 200);
      }
    });

    this.brighter(_event => {
      if (!interval) {
        log(`Starting ${this.config.device} brighter dimmer`);
        this.config.lights.forEach(light => {
          setState(`${light}.transition_time`, 0.2);
        });
        interval = setInterval(brighter, 200);
      }
    });

    this.stop(_event => {
      if (interval) {
        log(`Stopping ${this.config.device} dimmer`);
        clearInterval(interval);
        interval = undefined;

        this.config.lights.forEach(light => {
          setState(`${light}.transition_time`, 3);
        });
      }
    });

    if (this.config.on_off) {
      this.config.on_off.setUp(this.config);
    }
  }

  private dim(
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
      'info',
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

class Tradfi extends Driver {
  protected darker(cb: (event: iobJS.ChangedStateObject) => any) {
    on(
      { id: `${this.config.device}.down_button`, val: true, ack: true },
      event => cb(event),
    );
  }

  protected brighter(cb: (event: iobJS.ChangedStateObject) => any) {
    on({ id: `${this.config.device}.up_button`, val: true, ack: true }, event =>
      cb(event),
    );
  }

  protected stop(cb: (event: iobJS.ChangedStateObject) => any) {
    on(
      { id: `${this.config.device}.down_button`, val: false, ack: true },
      event => cb(event),
    );
    on(
      { id: `${this.config.device}.up_button`, val: false, ack: true },
      event => cb(event),
    );
  }
}

class Philips extends Driver {
  private _up_hold;
  private _down_hold;

  protected darker(cb: (event: iobJS.ChangedStateObject) => any) {
    this.down_hold()
      .pipe(
        filter((event: iobJS.ChangedStateObject) => event.state.val === true),
        tap((event: iobJS.ChangedStateObject) => cb(event)),
      )
      .subscribe();
  }

  protected brighter(cb: (event: iobJS.ChangedStateObject) => any) {
    this.up_hold()
      .pipe(
        filter((event: iobJS.ChangedStateObject) => event.state.val === true),
        tap((event: iobJS.ChangedStateObject) => cb(event)),
      )
      .subscribe();
  }

  protected stop(cb: (event: iobJS.ChangedStateObject) => any) {
    merge(this.down_hold(), this.up_hold())
      .pipe(
        filter((event: iobJS.ChangedStateObject) => event.state.val === false),
        debounceTime(900),
        tap(event => cb(event)),
      )
      .subscribe();
  }

  private down_hold() {
    if (this._down_hold) {
      return this._down_hold;
    }

    this._down_hold = Observable.create(observer => {
      on({ id: `${this.config.device}.down_hold`, ack: true }, event => {
        observer.next(event);
      });
    });

    return this._down_hold;
  }

  private up_hold() {
    if (this._up_hold) {
      return this._up_hold;
    }

    this._up_hold = Observable.create(observer => {
      on({ id: `${this.config.device}.up_hold`, ack: true }, event => {
        observer.next(event);
      });
    });

    return this._up_hold;
  }
}

const remotes = [
  new Tradfi({
    // Kitchen TRADFRI on/off switch
    device: 'zigbee.0.588e81fffe2bacf4',
    change: BRIGHTNESS_CHANGE,
    lights: [
      'zigbee.0.0017880108488e90', // Kitchen #1 5062431P7
      'zigbee.0.00178801084ceab3', // Kitchen #2 5062431P7
      'zigbee.0.00178801084ceb60', // Kitchen #3 5062431P7
      'zigbee.0.00178801084ce9b9', // Kitchen #4 5062431P7
      'zigbee.0.f0d1b8000010c9d9', // Dining #1 CLA60 RGBW Z3
      'zigbee.0.f0d1b8000010c4af', // Dining #2 CLA60 RGBW Z3
      'zigbee.0.f0d1b8000010b1cd', // Dining #3 CLA60 RGBW Z3
    ],
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
    change: BRIGHTNESS_CHANGE,
    lights: [
      'zigbee.0.0017880108376b6c', // Bedroom Philips Hue LCA001
    ],
    on_off: new Toggle(
      'zigbee.0.0017880108376b6c.state', // Bedroom Philips Hue LCA001
    ),
  }),
  new Philips({
    // Hue Remote RWL021
    device: 'zigbee.0.001788010872fbc4',
    change: BRIGHTNESS_CHANGE,
    lights: [
      'zigbee.0.00178801082e99a8', // Living Room Philips Hue LCA001 #1
      'zigbee.0.00178801061d8f64', // Living Room Philips Hue LCA001 #2
      'zigbee.0.0017880106a0aaf5', // Living Room Philips Hue LCA001 #3
      'zigbee.0.0017880106fbbd3e', // Living Room Philips Signe Floor Lamp
      'zigbee.0.00178801067ccd84', // Living Room Philips Signe Desk Lamp
      'zigbee.0.0017880104990734', // Living Room KandyLight
      'zigbee.0.001788010407dc4d', // Living Room Sideboard Philips Hue Lightstrip
    ],
    on_off: new Toggle(
      'scene.0.Living_Room_Lights_Bright',
      'scene.0.Living_Room_Lights',
    ),
  }),
];

remotes.forEach(remote => remote.setUp());
