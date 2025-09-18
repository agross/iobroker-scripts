import { Subscription } from 'rxjs';
import { filter, pairwise, tap } from 'rxjs/operators';

declare global {
  class AlarmConfig {
    public static homematicPresence: string;

    public static get triggerAlarmOn(): [string];

    public static allowDeviceAlarm(_stateId: string): boolean;

    public static alarmEnabledChanged(_enabled: boolean);
  }
}

export class AlarmConfig {
  public static homematicPresence = undefined;

  public static get triggerAlarmOn() {
    return [
      ...$('state[id=zigbee.*.opened]'),
      ...$('state[id=zigbee.*.occupancy]'),
    ];
  }

  public static allowDeviceAlarm(stateId: string): boolean {
    // If it is too cold, RTCGQ11LM will trigger without occupancy.
    const deviceType = Device.type(stateId);
    if (deviceType !== 'RTCGQ11LM') {
      return true;
    }

    // Living room temperature.
    const temp = getState('zigbee.0.00158d000689c5a6.temperature')
      .val as number;
    return temp && temp > 15;
  }

  static frigateMonitor?: Subscription;

  static frigate(alarmEnabled: boolean) {
    [
      'mqtt.0.ogd.frigate.notifications.set',
      ...$('mqtt.0.ogd.frigate.*.detect.set'),
      ...$('mqtt.0.ogd.frigate.*.motion.set'),
      ...$('mqtt.0.ogd.frigate.*.recordings.set'),
      ...$('mqtt.0.ogd.frigate.*.snapshots.set'),
    ].forEach(state => {
      log(
        `${alarmEnabled ? 'Enabling' : 'Disabling'} ${state.replace(/\.\w+?$/, '')}`,
      );
      setState(state, alarmEnabled ? 'ON' : 'OFF');
    });
  }

  public static alarmEnabledChanged(enabled: boolean) {
    AlarmConfig.frigate(enabled);

    // Frigate resets detection, motion etc. on restart according to its config.
    // https://github.com/blakeblackshear/frigate/issues/5502#issuecomment-1431280542
    // When a Frigate restart occurs while the alarm is disabled, set the
    // Frigate state accordingly.
    if (enabled) {
      this.frigateMonitor?.unsubscribe();
    } else {
      this.frigateMonitor = new Stream<number>('mqtt.0.ogd.frigate.stats', {
        map: event => JSON.parse(event.state.val).service.uptime,
      }).stream
        .pipe(
          pairwise(),
          filter(([prev, next]) => next - prev < 0),
          tap(([prev, next]) =>
            log(
              `Frigate was restarted with uptime ${prev} -> ${next}, reapplying`,
            ),
          ),
          tap(_ => AlarmConfig.frigate(false)),
        )
        .subscribe();
    }

    // Disable object tracking of the PTZ cam.
    const tracking = {
      bSmartTrack: enabled ? 1 : 0,
    };

    setState('reolink.0.ai_config.raw', JSON.stringify(tracking));

    // Go to privacy position and stay there.
    setState('reolink.0.settings.ptzEnableGuard', enabled);
    if (!enabled) {
      setState('reolink.0.settings.ptzPreset', 0);
    }
  }
}
