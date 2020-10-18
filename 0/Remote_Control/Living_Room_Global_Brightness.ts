const override = 'javascript.0.global-brightness-override';
const change = 5;

on({ id: 'hm-rpc.1.000B5A49A07F8D.3.PRESS_LONG', ack: true }, _ => {
  let brightness = getState(override).val - change;

  if (brightness < 1) {
    brightness = 1;
  }

  setState(override, brightness);
});

on({ id: 'hm-rpc.1.000B5A49A07F8D.4.PRESS_LONG', ack: true }, _ => {
  let brightness = getState(override).val + change;

  if (brightness > 100) {
    brightness = 100;
  }

  setState(override, brightness);
});
