const sensor = AdapterId.build(AdapterIds.zigbee, '00158d00045bedc5.opened'); // Entrance Door Contact
const scene = 'scene.0.Lights.Late_Night_Entry';
const allLightsOff = 'scene.0.Lights.All_Lights_Off';
const brightness = 'hm-rpc.1.000C1A49A87471.1.ILLUMINATION'; // Bathroom Presence Detector

function atNight() {
  return compareTime(
    getAstroDate('sunrise', undefined, 0),
    getAstroDate('sunsetStart', undefined, 0),
    'not between',
  );
}

function darkOutside() {
  return getState(brightness).val < 50;
}

on({ id: sensor, val: true, ack: true }, event => {
  if (!atNight()) {
    if (darkOutside()) {
      log('Daytime, but dark outside');
    } else {
      log('Daytime, skipping');
      return;
    }
  }

  if (getState(allLightsOff).val !== true) {
    log('Some lights are on, skipping');
    return;
  }

  setState(scene, true);
});
