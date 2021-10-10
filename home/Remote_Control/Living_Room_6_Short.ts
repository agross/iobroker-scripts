on(
  { id: 'hm-rpc.1.000B5A49A07F8D.6.PRESS_SHORT', change: 'any', ack: true },
  () => {
    setState('scene.0.Living Room.Lights_TV', true);
    setState('lgtv.0.states.power', true);
  },
);
