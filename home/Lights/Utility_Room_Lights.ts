const sensor = AdapterId.build(AdapterIds.zigbee, '00158d00045c1216.opened');
const scene = 'scene.0.Utility Room.Entered';
const timeoutMinutes = 2;
const timeout = timeoutMinutes * 60 * 1000;

on({ id: sensor, oldVal: false, val: true, ack: true }, event => {
  log(JSON.stringify(event));

  setState(scene, true);
  setStateDelayed(scene, false, timeout, true);
});

on({ id: sensor, val: false, ack: true }, event => {
  log(JSON.stringify(event));

  setState(scene, false);
});
