on(
  {
    id: 'hm-rpc.1.000C1A49A87471.1.PRESENCE_DETECTION_STATE',
    change: 'ne',
    ack: true,
  },
  event => {
    // Overridden by switch?
    if (getState('scene.0.Bathroom_Lights_Bright').val === true) {
      log('Bathroom lights overridden by switch');
      return;
    }

    // Bathroom empty?
    if (event.state.val === false) {
      log('Bathroom empty, turning off lights');
      setState('scene.0.Bathroom_Lights', false);
      return;
    }

    // Disabled by brightness?
    if (getState('hm-rpc.1.000C1A49A87471.1.ILLUMINATION').val > 5) {
      return;
    }

    let scene = 'scene.0.Bathroom_Lights_Low';

    if (compareTime('1:00', '6:00', 'between')) {
      scene = 'scene.0.Bathroom_Lights_Ultra_Low';
    }

    log(`Bathroom occupied, turning on ${scene}`);
    setState(scene, true);
  },
);
