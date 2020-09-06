on(
  {
    id: 'hm-rpc.1.000C1A49A87471.1.PRESENCE_DETECTION_STATE',
    change: 'ne',
    ack: true,
  },
  event => {
    // Overridden by switch?
    if (getState('scene.0.Bathroom.Lights_Bright').val === true) {
      log('Bathroom lights overridden by switch');
      return;
    }

    // Bathroom empty?
    if (event.state.val === false) {
      log('Bathroom empty, turning off lights');
      setState('scene.0.Bathroom.Lights', false);
      return;
    }

    // Disabled by brightness?
    if (getState('hm-rpc.1.000C1A49A87471.1.ILLUMINATION').val > 5) {
      return;
    }

    let scene = 'scene.0.Bathroom.Lights_Low';

    if (compareTime('1:00', '6:00', 'between')) {
      scene = 'scene.0.Bathroom.Lights_Ultra_Low';
    }

    // If any light is on, use a brighter scene.
    if (getState('scene.0.Lights.All_Lights_Off').val !== true) {
      scene = 'scene.0.Bathroom.Lights_Default';
    }

    log(`Bathroom occupied, turning on ${scene}`);
    setState(scene, true);
  },
);
