import { filter, tap, withLatestFrom, bufferCount, map } from 'rxjs/operators';

const config = {
  trigger: 'zigbee.0.00158d00070877fe.opened',
  activate: 'scene.0.Equipment Room.Lights_Cozy',
  off: 'scene.0.Equipment Room.Lights_Off',
  callbacks: [
    {
      text: '💡 Turn Off',
      callback_data: 'turn-off-equipment-room-lights',
      callbackReceived: () => {
        setState(config.off, true);
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

const lightsOff = new Stream<boolean>(config.off).stream;

const opened = new Stream<boolean>(config.trigger).stream
  .pipe(
    filter(x => x === true),
    filter(_ => atNight()),
    withLatestFrom(lightsOff),
    filter(([_, lightsOff]) => lightsOff === true),
    tap(_ => {
      setState(config.activate, true, err => {
        if (err) {
          log(`Could not activate ${config.activate}: ${err}`, 'error');
          Notify.mobile('🛠💡❌');
          return;
        }

        Notify.mobile('🛠💡', {
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

onStop(() => [callbacks, opened].forEach(x => x.unsubscribe()));
