export {};
await stopScriptAsync('Automation.Alarm');

// Disable object tracking of the PTZ cam.
const tracking = {
  bSmartTrack: 0,
};

setState('reolink.0.ai_config.raw', JSON.stringify(tracking));

// Go to monitoring position and stay there.
setState('reolink.0.settings.ptzEnableGuard', false);
setState('reolink.0.settings.ptzPreset', 1);

[
  ...$('mqtt.0.ogd.frigate.*.motion.set'),
  ...$('mqtt.0.ogd.frigate.*.recordings.set'),
].forEach(state => {
  setState(state, 'ON');
});

[
  'mqtt.0.ogd.frigate.notifications.set',
  ...$('mqtt.0.ogd.frigate.*.detect.set'),
  ...$('mqtt.0.ogd.frigate.*.snapshots.set'),
].forEach(state => {
  setState(state, 'OFF');
});

stopScript(undefined);
