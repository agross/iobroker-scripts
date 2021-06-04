on(
  {
    id: 'hm-rpc.1.000B5A49A07F8D.1.PRESS_SHORT',
    change: 'any',
    ack: true,
  },
  () => {
    const state = 'javascript.0.scriptEnabled.Automation.TV_Idle';
    const toggle = !getState(state).val;

    setState(state, toggle);
  },
);
