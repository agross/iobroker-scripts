import { EMPTY, of, timer } from 'rxjs';
import { filter, first, map, scan, switchMap, tap } from 'rxjs/operators';

type Config = {
  workingThreshold: number;
  finishedThreshold: number;
  powerMonitor: string;
  powerState: string;
  repowerTimeout: number;
  repowerState: string[];
  callbacks: any[];
};

const config: Config = {
  workingThreshold: 10,
  finishedThreshold: 18,
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

interface State {
  next(power: number): State;
}

class Idle implements State {
  constructor(private config: Config) {
    this.config = config;
  }

  next(powerUsage: number): State {
    if (powerUsage >= this.config.workingThreshold)
      return new Working(this.config, powerUsage);

    return this;
  }
}

class Working implements State {
  lastMeasurements: number[] = [];

  constructor(
    private config: Config,
    powerUsage: number,
  ) {
    this.config = config;

    this.lastMeasurements.push(powerUsage);
  }

  next(powerUsage: number): State {
    this.lastMeasurements.push(powerUsage);
    while (this.lastMeasurements.length > 6) {
      this.lastMeasurements.shift();
    }

    if (this.lastMeasurements.length < 6) {
      return this;
    }

    const lastMinute = this.lastMeasurements.reduce((acc, x) => acc + x, 0);

    if (lastMinute < this.config.finishedThreshold) {
      log(
        `Latest recorded power usage ${JSON.stringify(this.lastMeasurements)}`,
      );

      this.notify();
      this.cutPower();
      this.scheduleRepowering();
      return new Idle(this.config);
    }

    return this;
  }

  private notify() {
    Notify.mobile(`Washing machine has finished`, {
      telegram: {
        reply_markup: {
          inline_keyboard: [this.config.callbacks],
        },
      },
    });
  }

  private cutPower() {
    setState(this.config.powerState, false);
  }

  private scheduleRepowering() {
    const dueDate = new Date(Date.now() + this.config.repowerTimeout);

    setState(
      this.config.repowerState.join('.'),
      dueDate.toISOString(),
      true,
      err => {
        if (err) {
          log(
            `Could not set timestamp to repower washing machine to ${Format.dateTime(
              dueDate,
            )}: ${err}`,
            'error',
          );
        } else {
          log(
            `Set timestamp to repower washing machine to ${Format.dateTime(
              dueDate,
            )}`,
          );
        }
      },
    );
  }
}

const monitor = new Stream<number>(config.powerMonitor, {
  map: event => event.state.val as number,
  pipe: obs => obs, // All values, not distinct ones.
}).stream
  .pipe(
    scan((state: State, powerUsage) => {
      const next = state.next(powerUsage);

      if (state.constructor.name !== next.constructor.name) {
        log(
          `Power usage ${powerUsage} causing ${state.constructor.name} -> ${next.constructor.name}`,
        );
      }

      return next;
    }, new Idle(config)),
  )
  .subscribe();

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
    map(x => config.callbacks.find(c => c.callback_data === x.value)),
    filter(x => x !== undefined),
    tap(x => log(`Callback match: ${JSON.stringify(x)}`)),
    tap(x => x.callbackReceived()),
  )
  .subscribe();

onStop(() => {
  [monitor, repower, callbacks].forEach(x => x.unsubscribe());
});
