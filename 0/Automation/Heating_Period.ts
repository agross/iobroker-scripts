const heatingPeriod = 'hm-rega.0.2322';

// May 1st.
schedule('0 0 1 5 *', () => {
  setState(heatingPeriod, false);

  sendTo('pushbullet', {
    message: 'Heating period ended',
    title: 'ioBroker',
    type: 'note',
  });
});

// October 1st.
schedule('0 0 1 10 *', () => {
  setState(heatingPeriod, true);

  sendTo('pushbullet', {
    message: 'Heating period started',
    title: 'ioBroker',
    type: 'note',
  });
});
