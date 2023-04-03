import { filter, tap, withLatestFrom, bufferCount, map } from 'rxjs/operators';

const config = {
  presence: '0_userdata.0.presence',
  absentForAtLeastMinutes: 15,
  houseLightsOff: 'scene.0.House.Lights_Off',
  activate: 'scene.0.House.Lights_Cozy',
  callbacks: [
    {
      text: '💡 Turn Off',
      callback_data: 'turn-off-house-lights',
      callbackReceived: () => {
        setState(config.houseLightsOff, true);
      },
    },
  ],
};

function atNight() {
  return compareTime(
    getAstroDate('sunrise', undefined, 0),
    getAstroDate('sunsetStart', undefined, 0),
    'not between',
  );
}

const callbacks = Notify.subscribeToCallbacks()
  .pipe(
    tap(x => log(`Callback: ${JSON.stringify(x)}`)),
    map(x => config.callbacks.find(c => c.callback_data === x.value)),
    filter(x => x !== undefined),
    tap(x => log(`Callback match: ${JSON.stringify(x)}`)),
    tap(x => x.callbackReceived()),
  )
  .subscribe();

const houseLightsOff = new Stream<boolean>(config.houseLightsOff).stream;

const returned = new Stream<{ present: boolean; timestamp: Date }>(
  config.presence,
  {
    map: e => {
      return { present: e.state.val, timestamp: new Date(e.state.ts) };
    },
  },
).stream
  .pipe(
    bufferCount(2, 1),
    filter(([x, y]) => x.present === false && y.present === true),
    filter(
      ([x, y]) =>
        (y.timestamp.valueOf() - x.timestamp.valueOf()) / 60000 >
        config.absentForAtLeastMinutes,
    ),
    filter(_ => atNight()),
    withLatestFrom(houseLightsOff),
    filter(([_, houseLightsOff]) => houseLightsOff === true),
    tap(([leftAndReturned, _]) => {
      const [left, returned] = leftAndReturned;
      log(
        `Returned at night after being absent for ${
          config.absentForAtLeastMinutes
        } min (from ${left.timestamp.formatDateTime()} to ${returned.timestamp.formatDateTime()}) with no lights on, activating ${
          config.activate
        }`,
      );

      setState(config.activate, true, err => {
        if (err) {
          log(`Could not activate ${config.activate}: ${err}`, 'error');
          Notify.mobile('🏡💡❌');
          return;
        }

        Notify.mobile('🏡💡', {
          telegram: {
            reply_markup: {
              inline_keyboard: [config.callbacks],
            },
          },
        });
      });
    }),
  )
  .subscribe();

onStop(() => [returned, callbacks].forEach(x => x.unsubscribe()));
