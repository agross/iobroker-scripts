import { Temporal } from 'temporal-polyfill';

const config = {
  sensor: AdapterId.build(AdapterIds.zigbee, '00158d00045c1216.opened'),
  scene: 'scene.0.Utility Room.Entered',
  timeout: Temporal.Duration.from({ minutes: 2 }),
};

on({ id: config.sensor, oldVal: false, val: true, ack: true }, event => {
  log(JSON.stringify(event));

  setState(config.scene, true);
  setStateDelayed(
    config.scene,
    false,
    config.timeout.total('milliseconds'),
    true,
  );
});

on({ id: config.sensor, val: false, ack: true }, event => {
  log(JSON.stringify(event));

  setState(config.scene, false);
});
