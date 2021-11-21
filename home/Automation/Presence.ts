import { combineLatest } from 'rxjs';
import { tap, map, distinctUntilChanged } from 'rxjs/operators';

const config = {
  presenceIndicators: ['ping.0.iobroker.172_16_0_15'],
  presence: ['0_userdata.0', 'presence'],
};

await ObjectCreator.create(
  {
    [config.presence[1]]: {
      type: 'state',
      common: {
        name: 'Presence',
        type: 'boolean',
        def: false,
        read: true,
        write: false,
        role: 'state',
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id('Presence'),
            attr_icon: 'mdi:location-enter',
          },
        },
      } as iobJS.StateCommon,
      native: {},
    },
  },
  config.presence[0],
);

const presenceIndication = config.presenceIndicators.map(indicator => {
  return new Stream<boolean>(indicator).stream;
});

const present = combineLatest(presenceIndication)
  .pipe(
    map(flags => flags.some(f => f)),
    distinctUntilChanged(),
    tap(present => log(`Presence indication: ${present}`)),
    tap(present => {
      setState(config.presence.join('.'), present, true, err => {
        if (err) {
          log(`Could not set presence to ${present}: ${err}`, 'error');
        } else {
          log(`Set presence to ${present}`);
        }
      });
    }),
  )
  .subscribe();

onStop(() => {
  [present].forEach(x => x.unsubscribe());
});
