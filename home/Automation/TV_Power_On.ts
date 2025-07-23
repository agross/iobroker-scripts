// import wol from 'wake_on_lan';
var wol = require('wake_on_lan');

const config = {
  monitor: 'lgtv.0.states.power',
  mac: 'lgtv.0.states.mac',
};

on({ id: config.monitor, val: true, ack: false }, _ => {
  log(`Got power-on command for TV, sending WOL packet on correct interface`);

  wol.wake(getState(config.mac).val, { address: '172.16.0.255' });
});
