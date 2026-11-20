import { Temporal } from 'temporal-polyfill';

const heatingPeriod = '0_userdata.0.Heating.period';
const { month } = Temporal.Now.plainDateISO();

await createStateAsync(heatingPeriod, month < 5 || month >= 10, false, {
  name: 'Heating Period',
  type: 'boolean',
  read: true,
  write: true,
  role: 'switch',
  custom: {
    [AdapterIds.lovelace]: {
      enabled: true,
      entity: 'switch',
      name: Lovelace.id('Heating Period'),
      attr_icon: 'mdi:radiator',
      attr_friendly_name: 'Heating Period',
    },
  },
});

on({ id: heatingPeriod, ack: false, change: 'any' }, event => {
  setState(heatingPeriod, event.state.val, true);
});

// May 1st.
schedule('0 0 1 5 *', () => {
  setState(heatingPeriod, false, true);

  Notify.mobile('Heating period ended');
});

// October 1st.
schedule('0 0 1 10 *', () => {
  setState(heatingPeriod, true, true);

  Notify.mobile('Heating period started');
});
