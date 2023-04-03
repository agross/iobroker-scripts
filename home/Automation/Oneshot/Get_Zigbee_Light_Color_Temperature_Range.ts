const config = {
  device: '0017880109e0b43e',
};

const payload = {
  read: {
    cluster: 'lightingColorCtrl',
    attributes: ['colorTempPhysicalMin', 'colorTempPhysicalMax'],
  },
};

sendTo(
  AdapterIds.zigbee,
  'SendToDevice',
  {
    device: config.device,
    payload: payload,
  },
  result => {
    log(result);
  },
);

stopScript(undefined);
