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
}
