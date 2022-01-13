import { filter, tap, throttleTime } from 'rxjs/operators';

const config = {
  counter: ['0_userdata.0', 'coffee-counter'],
  indicator: 'zigbee.0.00158d000483b44d.vibration',
};

await ObjectCreator.create(
  {
    [config.counter[1]]: {
      type: 'channel',
      native: {},
      common: { name: 'Coffee Counter' },
      nested: {
        counter: {
          type: 'state',
          common: {
            name: 'Coffee Counter',
            type: 'number',
            def: 0,
            read: true,
            write: true,
            role: 'state',
            custom: {
              [AdapterIds.lovelace]: {
                enabled: true,
                entity: 'sensor',
                name: Lovelace.id('Coffee Counter'),
                attr_icon: 'mdi:coffee',
              },
            },
          } as iobJS.StateCommon,
          native: {},
        },
        reset: {
          type: 'state',
          common: {
            name: 'Reset Coffee Counter',
            type: 'boolean',
            def: false,
            read: true,
            write: true,
            role: 'switch',
            custom: {
              [AdapterIds.lovelace]: {
                enabled: true,
                entity: 'switch',
                name: Lovelace.id('Reset Coffee Counter'),
              },
            },
          } as iobJS.StateCommon,
          native: {},
        },
      },
    },
  },
  config.counter[0],
);

const coffeeBrewed = new Stream<boolean>({
  id: config.indicator,
  ack: true,
}).stream
  .pipe(
    throttleTime(30000),
    tap(_ => {
      const counterState = config.counter.join('.') + '.counter';

      const count = (getState(counterState).val || 0) + 1;

      setState(counterState, count, true);
      Notify.mobile(`Coffee count: ${count}`);
    }),
  )
  .subscribe();

const resetState = config.counter.join('.') + '.reset';
const reset = new Stream<boolean>({
  id: resetState,
  ack: false,
}).stream
  .pipe(
    filter(x => x === true),
    tap(_ => {
      const counterState = config.counter.join('.') + '.counter';

      setState(counterState, 0, true);
      setState(resetState, false, true);
    }),
  )
  .subscribe();

onStop(() => {
  [coffeeBrewed, reset].forEach(x => x.unsubscribe());
});
