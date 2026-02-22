const remote = 'hm-rpc.1.000B5A49A07F8D';

on(
  {
    id: `${remote}.1.PRESS_SHORT`,
    change: 'any',
    ack: true,
  },
  () => {
    const state = 'javascript.0.scriptEnabled.Automation.TV_Idle';
    const toggle = !getState(state).val;

    setState(state, toggle);
  },
);

on({ id: `${remote}.2.PRESS_SHORT`, change: 'any', ack: true }, () =>
  setState('scene.0.Living Room.Launch_Kodi', true),
);

on({ id: `${remote}.3.PRESS_SHORT`, change: 'any', ack: true }, () =>
  setState('scene.0.Kitchen.Lights_Off', true),
);

on({ id: `${remote}.4.PRESS_SHORT`, change: 'any', ack: true }, () =>
  setState('scene.0.Living Room.Lights_Cozy', true),
);

on({ id: `${remote}.5.PRESS_SHORT`, change: 'any', ack: true }, () =>
  setState('scene.0.Lights.Bedtime', true),
);

on({ id: `${remote}.6.PRESS_LONG`, change: 'any', ack: true }, () =>
  setState('scene.0.Lights.Party', true),
);

on({ id: `${remote}.6.PRESS_SHORT`, change: 'any', ack: true }, () => {
  setState('scene.0.Living Room.Lights_TV', true);
  setState('lgtv.0.states.power', true);
});
