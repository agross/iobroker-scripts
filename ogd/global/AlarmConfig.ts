class AlarmConfig {
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

  public static alarmEnabledChanged(enabled: boolean) {
    [
      'mqtt.0.ogd.frigate.notifications.set',
      ...$('mqtt.0.ogd.frigate.*.detect.set'),
      ...$('mqtt.0.ogd.frigate.*.motion.set'),
      ...$('mqtt.0.ogd.frigate.*.recordings.set'),
      ...$('mqtt.0.ogd.frigate.*.snapshots.set'),
    ].forEach(state => {
      log(
        `${enabled ? 'Enabling' : 'Disabling'} ${state.replace(/\.\w+?$/, '')}`,
      );
      setState(state, enabled ? 'ON' : 'OFF');
    });

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
