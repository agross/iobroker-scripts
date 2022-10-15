import { filter, map, tap, throttleTime } from 'rxjs/operators';

const config = {
  counter: ['0_userdata.0', 'coffee-counter'],
  resetCounter: () => config.counter.join('.') + '.reset',
  indicator: 'zigbee.0.00158d000483b44d.vibration',
  callbacks: [
    {
      text: '0️⃣ Reset Counter',
      callback_data: 'coffee-counter-reset',
      callbackReceived: () => {
        setState(config.resetCounter(), true);
      },
    },
  ],
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

const callbacks = Notify.subscribeToCallbacks()
  .pipe(
    tap(x => log(`Callback: ${JSON.stringify(x)}`)),
    map(x => config.callbacks.find(c => c.callback_data === x.value)),
    filter(x => x !== undefined),
    tap(x => log(`Callback match: ${JSON.stringify(x)}`)),
    tap(x => x.callbackReceived()),
  )
  .subscribe();

const coffeeBrewed = new Stream<boolean>({
  id: config.indicator,
  ack: true,
}).stream
  .pipe(
    filter(x => x === true),
    throttleTime(60000),
    tap(_ => {
      const counterState = config.counter.join('.') + '.counter';

      const count = (getState(counterState).val || 0) + 1;

      setState(counterState, count, true);
      Notify.mobile(`Coffee count: ${count}`, {
        telegram: {
          reply_markup: {
            inline_keyboard: [config.callbacks],
          },
        },
      });
    }),
  )
  .subscribe();

const reset = new Stream<boolean>({
  id: config.resetCounter(),
  ack: false,
}).stream
  .pipe(
    filter(x => x === true),
    tap(_ => {
      const counterState = config.counter.join('.') + '.counter';

      setState(counterState, 0, true);
      setState(config.resetCounter(), false, true);
    }),
  )
  .subscribe();

onStop(() => {
  [callbacks, coffeeBrewed, reset].forEach(x => x.unsubscribe());
});
