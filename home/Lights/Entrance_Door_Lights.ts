const config = {
  // Entrance Door Contact
  sensor: AdapterId.build(AdapterIds.zigbee, '00158d00045bedc5.opened'),
  scene: 'scene.0.Lights.Late_Night_Entry',
  allLightsOff: 'scene.0.Lights.All_Lights_Off',
  // Bathroom Presence Detector
  brightness: 'hm-rpc.1.000C1A49A87471.1.ILLUMINATION',
};

function atNight() {
  return compareTime(
    getAstroDate('sunrise', undefined, 0),
    getAstroDate('sunsetStart', undefined, 0),
    'not between',
  );
}

function darkOutside() {
  return getState(config.brightness).val < 50;
}

on({ id: config.sensor, val: true, ack: true }, event => {
  if (!atNight()) {
    if (darkOutside()) {
      log('Daytime, but dark outside');
    } else {
      log('Daytime, skipping');
      return;
    }
  }

  if (getState(config.allLightsOff).val !== true) {
    log('Some lights are on, skipping');
    return;
  }

  setState(config.scene, true);
});
