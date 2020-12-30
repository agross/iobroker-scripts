const heatingPeriod = 'hm-rega.0.2322';

// May 1st.
schedule('0 0 1 5 *', () => {
  setState(heatingPeriod, false);

  Notify.mobile('Heating period ended');
});

// October 1st.
schedule('0 0 1 10 *', () => {
  setState(heatingPeriod, true);

  Notify.mobile('Heating period started');
});
