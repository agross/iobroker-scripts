class AlarmConfig {
  public static readonly alarmState = ['0_userdata.0', 'alarm-enabled'];

  public static get triggerAlarmOn() {
    return [...$('state[id=zigbee.*.opened]')];
  }

  public static allowDeviceAlarm(_stateId: string): boolean {
    return true;
  }

  public static alarmEnabledChanged(_enabled: boolean) {}
}
