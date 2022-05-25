import { filter, tap, withLatestFrom } from 'rxjs/operators';

const config = {
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
  ],
  returning: {
    trigger: new Stream<boolean>({
      id: '0_userdata.0.presence',
    }).stream.pipe(
      withLatestFrom(
        new Stream('scene.0.Leaving.Long-Term', { map: e => e.state.val })
          .stream,
      ),
      filter(([presence, longGone]) => presence === true && longGone !== false), // true or uncertain
    ),
    activate: 'scene.0.Leaving.Returning',
  },
};

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
  [...leaving, returning].forEach(x => x.unsubscribe());
});
