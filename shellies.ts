abstract class Driver {
  protected topic(device: string): string {
    return `mqtt.0.home.${device}.POWER`;
  }

  protected array(value: string | string[]): string[] {
    return Array.isArray(value) ? value : [value];
  }
}

interface ToggleConfig {
  device: string | string[];
  control: string | string[];
}

class Toggle extends Driver {
  private _config: ToggleConfig;

  constructor(config: ToggleConfig) {
    super();
    this._config = config;
  }

  public setUp(): void {
    this.array(this._config.device).forEach(device => {
      on({ id: this.topic(device), change: 'ne', ack: true }, _state => {
        this.array(this._config.control).forEach(device => {
          getState(device, function (err, state) {
            if (!err) {
              setState(device, state ? !state.val : true);
            }
          });
        });
      });
    });
  }
}

interface OnOffConfig {
  device: string | string[];
  on: string | string[];
  off: string | string[];
}

class OnOff extends Driver {
  private _config: OnOffConfig;

  constructor(config: OnOffConfig) {
    super();
    this._config = config;
  }

  public setUp(): void {
    this.array(this._config.device).forEach(device => {
      on({ id: this.topic(device), change: 'ne', ack: true }, state => {
        const isOff =
          this.array(this._config.off)
            .map(off => getState(off).val)
            .filter(val => !val).length > 0;

        log(`${state.id}: is off?: ${isOff}`);

        let control = this._config.off;
        if (isOff) {
          control = this._config.on;
        }

        this.array(control).forEach(device => {
          setState(device, isOff);
        });
      });
    });
  }
}

const shellies = [
  new Toggle({
    device: 'utility-room.power.stat.shelly1-1',
    control: 'zigbee.0.680ae2fffea72a25.state', // Utility Room TRADFRI bulb E27 WS opal 1000lm
  }),
  new OnOff({
    device: 'bedroom.power.stat.shelly1-2',
    on: 'scene.0.Bedroom_Lights_Bright',
    off: 'scene.0.Bedroom_Lights',
  }),
  new OnOff({
    device: 'hall.power.stat.shelly1-3',
    on: 'scene.0.Bathroom_Lights_Bright',
    off: 'scene.0.Bathroom_Lights',
  }),
  new Toggle({
    device: 'hall.power.stat.shelly1-8',
    control: 'zigbee.0.7cb03eaa00a9df17.state', // Hall CLA60 RGBW OSRAM
  }),
  new Toggle({
    device: 'office.power.stat.shelly1-4',
    control: 'zigbee.0.f0d1b8000010c4af.state', // Office CLA60 RGBW Z3
  }),
  new OnOff({
    device: ['kitchen.power.stat.shelly1-7', 'kitchen.power.stat.shelly1-9'],
    on: 'scene.0.Kitchen_Lights_Bright',
    off: 'scene.0.Kitchen_Lights',
  }),
  ,
  new OnOff({
    device: [
      'living-room.power.stat.shelly1-5',
      'living-room.power.stat.shelly1-6',
      'kitchen.power.stat.shelly1-10',
    ],
    on: 'scene.0.Living_Room_Lights_Bright',
    off: 'scene.0.Living_Room_Lights',
  }),
];

shellies.forEach(shelly => shelly.setUp());
