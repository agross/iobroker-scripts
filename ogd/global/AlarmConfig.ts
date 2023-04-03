class AlarmConfig {
  public static homematicPresence = undefined;

  public static get triggerAlarmOn() {
    return [
      ...$('state[id=zigbee.*.opened]'),
      ...$('state[id=zigbee.*.occupancy]'),
    ];
  }
}
