const sensor = 'zigbee.0.00158d00045bedc5.opened'; // Entrance Door Contact
const scene = 'scene.0.Late_Night_Entry';

function atNight() {
  return compareTime(
    getAstroDate('sunrise', undefined, 0),
    getAstroDate('sunsetStart', undefined, 0),
    'not between',
  );
}

on({ id: sensor, val: true, ack: true }, event => {
  if (!atNight()) {
    log('Daytime, skipping');
    return;
  }

  if (getState('scene.0.All_Lights').val !== false) {
    log('Some lights are on, skipping');
    return;
  }

  setState(scene, event.state.val);
});
