import { of, timer } from 'rxjs';
import { filter, map, switchMap, tap } from 'rxjs/operators';

const config = {
  sunnyDay: ShutterConfig.sunnyDay,
  sunnyDayExceptions: ShutterConfig.sunnyDayExceptions,
  afternoon: ShutterConfig.afternoon,
  scenes: {
    night: 'scene.0.Shutters.Night',
    day: 'scene.0.Shutters.Day',
    sunnyDay: 'scene.0.Shutters.Sunny_Day',
    sunnyDayAfternoon: 'scene.0.Shutters.Sunny_Day_Afternoon',
  },
  disable: ShutterConfig.disable,
  next: {
    root: ['0_userdata.0', 'Shutters'],
    combined: 'combined', // Stores the values below in an object.
    state: 'next-state', // These are for display purposes only.
    dueDate: 'next-due-date',
  },
};

type NextState = { state: 'day' | 'sunnyDayAfternoon' | 'night'; dueAt: Date };

function getObjectDefinition(): ObjectDefinitionRoot {
  return {
    [config.next.root[1]]: {
      type: 'channel',
      common: { name: 'Scheduled Shutter State' },
      native: {},
      nested: {
        [config.next.combined]: {
          type: 'state',
          common: {
            name: 'Next Shutter State as JSON',
            type: 'string',
            read: true,
            write: false,
            role: 'json',
            def: JSON.stringify(null),
          },
          native: {},
        },
        [config.next.state]: {
          type: 'state',
          common: {
            name: 'Next Shutter State',
            type: 'string',
            read: true,
            write: false,
            role: 'value',
            custom: {
              [AdapterIds.lovelace]: {
                enabled: true,
                entity: 'sensor',
                name: Lovelace.id(`Next Shutter State`),
              },
            },
          },
          native: {},
        },
        [config.next.dueDate]: {
          type: 'state',
          common: {
            name: 'Next Shutter State Due Date',
            type: 'mixed',
            read: true,
            write: false,
            role: 'value',
            custom: {
              [AdapterIds.lovelace]: {
                enabled: true,
                entity: 'sensor',
                name: Lovelace.id(`Next Shutter State Due Date`),
                attr_device_class: 'timestamp',
              },
            },
          },
          native: {},
        },
      },
    },
  };
}

await ObjectCreator.create(getObjectDefinition(), config.next.root[0]);

async function scheduleNextState(state: NextState) {
  log(`Scheduling next shutter state: ${JSON.stringify(state)}`);

  await setStateAsync(
    config.next.root.concat([config.next.combined]).join('.'),
    JSON.stringify(state),
    true,
  );
  await setStateAsync(
    config.next.root.concat([config.next.state]).join('.'),
    state.state,
    true,
  );
  await setStateAsync(
    config.next.root.concat([config.next.dueDate]).join('.'),
    state.dueAt.toISOString(),
    true,
  );
}

async function activateScene(scene: string, extra?: () => void) {
  if (await config.disable()) {
    return;
  }

  extra && extra();

  await setStateAsync(scene, true);
}

const sunnyDayExceptions = Notify.subscribeToCallbacks()
  .pipe(
    tap(x => log(`Callback: ${JSON.stringify(x)}`)),
    map(x => config.sunnyDayExceptions.find(c => c.callback_data === x.value)),
    filter(x => x !== undefined),
    tap(x => log(`Callback match: ${JSON.stringify(x)}`)),
    tap(x => x.callbackReceived()),
  )
  .subscribe();

const next = new Stream<NextState>(
  config.next.root.concat([config.next.combined]).join('.'),
  {
    map: e => {
      const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

      function reviver(_key, value) {
        if (typeof value === 'string' && dateFormat.test(value)) {
          return new Date(value);
        }

        return value;
      }

      return JSON.parse(e.state.val, reviver);
    },
  },
);

// If there is no initial "next state", start with "day" right now.
const initialState = next.stream
  .pipe(
    filter(next => !next || next.state?.length === 0),
    tap(async _ => {
      log('Starting with initial "day" state due now', 'warn');

      await scheduleNextState({
        state: 'day',
        dueAt: new Date(),
      });
    }),
  )
  .subscribe();

const nextState = next.stream
  .pipe(
    filter(next => next?.state?.length > 0),
    filter(next => {
      if (!next.dueAt) {
        log(
          `Next shutter state without timestamp: ${JSON.stringify(next)}`,
          'warn',
        );

        return false;
      }

      return true;
    }),
    switchMap(next => {
      // If the next.dueAt is in the past, run immediately.
      const dueAt = new Date() > next.dueAt ? of(1) : timer(next.dueAt);

      switch (next.state) {
        case 'day':
          return dueAt.pipe(
            tap(async _ => {
              if (await config.sunnyDay()) {
                const afternoon = config.afternoon();

                activateScene(config.scenes.sunnyDay, () => {
                  Notify.mobile(
                    `Sunny day shutters until ${Format.dateTime(afternoon)}`,
                    {
                      telegram: {
                        reply_markup: {
                          inline_keyboard: [ShutterConfig.sunnyDayExceptions],
                        },
                      },
                    },
                  );
                });

                await scheduleNextState({
                  state: 'sunnyDayAfternoon',
                  dueAt: afternoon,
                });
              } else {
                activateScene(config.scenes.day);

                await scheduleNextState({
                  state: 'night',
                  dueAt: getAstroDate('sunsetStart'),
                });
              }
            }),
          );

        case 'sunnyDayAfternoon':
          return dueAt.pipe(
            tap(async _ => {
              activateScene(config.scenes.sunnyDayAfternoon, () => {
                Notify.mobile(`Setting shutters to sunny day afternoon levels`);
              });

              await scheduleNextState({
                state: 'night',
                dueAt: getAstroDate('sunsetStart'),
              });
            }),
          );

        case 'night':
          return dueAt.pipe(
            tap(async _ => {
              await activateScene(config.scenes.night);

              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const sunriseTomorrow = getAstroDate('sunrise', tomorrow);

              await scheduleNextState({
                state: 'day',
                dueAt: sunriseTomorrow,
              });
            }),
          );

        default:
          log(
            `Unsupported next shutter state: ${JSON.stringify(next)}`,
            'error',
          );
          break;
      }

      return dueAt;
    }),
  )
  .subscribe();

onStop(() =>
  [initialState, nextState, sunnyDayExceptions].forEach(x => x.unsubscribe()),
);
