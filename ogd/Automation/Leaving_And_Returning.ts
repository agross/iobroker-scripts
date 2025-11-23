import { filter, tap, withLatestFrom } from 'rxjs/operators';

const config = {
  longTermAbsence: ['0_userdata.0', 'long-term-absence'],
  leaving: [
    {
      trigger: AdapterId.build(AdapterIds.zigbee, '54ef4410001ce745.double'),
      activate: 'scene.0.Leaving.Short-Term',
    },
    {
      trigger: AdapterId.build(
        AdapterIds.zigbee,
        '54ef4410001c6707.double_left',
      ),
      activate: 'scene.0.Leaving.Long-Term',
    },
    {
      trigger: AdapterId.build(
        AdapterIds.zigbee,
        '54ef4410001c6707.double_right',
      ),
      activate: 'scene.0.House.Getting_Wood',
    },
  ],
  returning: {
    trigger: new Stream<boolean>('0_userdata.0.presence').stream.pipe(
      withLatestFrom(
        new Stream<boolean>('0_userdata.0.long-term-absence').stream,
      ),
      filter(
        ([presence, longTermAbsence]) =>
          presence === true && longTermAbsence === true,
      ),
      tap(_ => Notify.mobile(`Welcome back to ${Site.location}!`)),
      tap(_ => log('Return after long-term absence, preparing the house')),
    ),
    activate: 'scene.0.Leaving.Returning',
  },
};

await ObjectCreator.create(
  {
    [config.longTermAbsence[1]]: {
      type: 'state',
      common: {
        name: 'Long-Term Absence',
        type: 'boolean',
        def: false,
        read: true,
        write: true,
        role: 'state',
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id('Long-Term Absence'),
            attr_icon: 'mdi:car-traction-control',
          },
        },
      } as iobJS.StateCommon,
      native: {},
    },
  },
  config.longTermAbsence[0],
);

const longTermAbsenceId = config.longTermAbsence.join('.');

const acknowledgeCommand = new Stream<boolean>({
  id: longTermAbsenceId,
  ack: false,
}).stream
  .pipe(
    tap(x => log(`Acknowledging command: ${longTermAbsenceId} = ${x}`)),
    tap(x => setState(longTermAbsenceId, x, true)),
  )
  .subscribe();

const leaving = config.leaving.map(c => {
  return new Stream<boolean>(c.trigger).stream
    .pipe(
      filter(x => x === true),
      tap(_ => setState(c.activate, true)),
    )
    .subscribe();
});

const returning = config.returning.trigger
  .pipe(tap(_ => setState(config.returning.activate, true)))
  .subscribe();

onStop(() => {
  [...leaving, returning, acknowledgeCommand].forEach(x => x.unsubscribe());
});
