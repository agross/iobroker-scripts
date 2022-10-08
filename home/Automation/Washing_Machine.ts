import { EMPTY, of, timer } from 'rxjs';
import {
  bufferCount,
  filter,
  first,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';

const config = {
  workingThreshold: 10,
  finishedThreshold: 20,
  powerMonitor: 'alias.0.mqtt.0.home.bathroom.power.gosund-sp111-3.power',
  powerState: 'alias.0.mqtt.0.home.bathroom.power.gosund-sp111-3.state',
  repowerTimeout:
    8 /* hours */ * 60 /* minutes */ * 60 /* seconds */ * 1000 /* ms */,
  repowerState: ['0_userdata.0', 'repower-washing-machine'],
  callbacks: [
    {
      text: '⚡️ Repower Now',
      callback_data: 'repower-washing-machine',
      callbackReceived: () => {
        setState(config.powerState, true);
      },
    },
  ],
};

await ObjectCreator.create(
  {
    [config.repowerState[1]]: {
      type: 'state',
      common: {
        name: 'Repower Washing Machine',
        type: 'mixed',
        def: null,
        read: true,
        write: true,
        role: 'indicator',
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'sensor',
            name: Lovelace.id('Repower Washing Machine'),
            attr_device_class: 'timestamp',
          },
        },
      } as iobJS.StateCommon,
      native: {},
    },
  },
  config.repowerState[0],
);

const powerUsage = new Stream<number>(config.powerMonitor, {
  map: event => event.state.val as number,
  pipe: obs => obs, // All values, not distinct ones.
}).stream;

const running = powerUsage.pipe(
  tap(watts => log(`Usage ${JSON.stringify(watts)}`, 'debug')),
  filter(watts => watts >= config.workingThreshold),
);

const notRunning = powerUsage.pipe(
  // Last 6 values, 10 s intervals, e.g. [3, 3, 3, 2, 2, 2]
  bufferCount(6),
  tap(watts => log(`Buffer ${watts}`)),
  map(watts => watts.reduce((acc, x) => acc + x, 0)),
  filter(watts => watts < config.finishedThreshold),
);

const repower = new Stream<string>(config.repowerState.join('.')).stream
  .pipe(
    switchMap(date => {
      if (!date) {
        return EMPTY;
      }

      const dueDate = new Date(date);
      if (dueDate < new Date()) {
        return of(1);
      }

      return timer(dueDate).pipe(first());
    }),
    tap(_ => {
      setState(config.powerState, true, false, err => {
        if (err) {
          log(`Could not repower washing machine: ${err}`, 'error');
        } else {
          Notify.mobile('Washing machine repowered');
        }
      });

      setState(config.repowerState.join('.'), null, true, err => {
        if (err) {
          log(
            `Could not reset ${config.repowerState.join('.')}: ${err}`,
            'error',
          );
        }
      });
    }),
  )
  .subscribe();

const callbacks = Notify.subscribeToCallbacks()
  .pipe(
    tap(x => log(`Callback: ${JSON.stringify(x)}`)),
    map(x => config.callbacks.find(ex => ex.callback_data == x.value)),
    filter(x => x !== undefined),
    tap(x => log(`Callback match: ${JSON.stringify(x)}`)),
    tap(x => x.callbackReceived()),
  )
  .subscribe();

const done = running
  .pipe(
    switchMap(_ => notRunning.pipe(first())),
    tap(_ =>
      Notify.mobile(`Washing machine has finished`, {
        telegram: {
          reply_markup: {
            inline_keyboard: [config.callbacks],
          },
        },
      }),
    ),
    tap(_ => setState(config.powerState, false)),
    tap(_ => {
      const dueDate = new Date(Date.now() + config.repowerTimeout);

      setState(
        config.repowerState.join('.'),
        dueDate.toISOString(),
        true,
        err => {
          if (err) {
            log(
              `Could not set timestamp to repower washing machine to ${dueDate.formatDatTime()}: ${err}`,
              'error',
            );
          } else {
            log(
              `Set timestamp to repower washing machine to ${dueDate.formatDatTime()}`,
            );
          }
        },
      );
    }),
  )
  .subscribe();

onStop(() => {
  [done, repower].forEach(x => x.unsubscribe());
});
