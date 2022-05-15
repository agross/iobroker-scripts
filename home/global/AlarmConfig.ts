class Alarm {
  public static homematicPresence = 'hm-rega.0.950';

  public static get triggerAlarmOn() {
    return [...$('state[id=zigbee.*.opened]')];
  }
}
