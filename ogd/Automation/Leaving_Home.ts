import { filter, tap } from 'rxjs/operators';

const config = [
  {
    trigger: AdapterId.build(AdapterIds.zigbee, '54ef4410001ce745.double'),
    activate: 'scene.0.Leaving.Short-Term',
  },
  {
    trigger: AdapterId.build(AdapterIds.zigbee, '54ef4410001ce745.double_left'),
    activate: 'scene.0.Leaving.Long-Term',
  },
];
var subscriptions = config.map(c => {
  return new Stream<boolean>({
    id: c.trigger,
    ack: true,
  }).stream
    .pipe(
      filter(x => x === true),
      tap(_ => setState(c.activate, true)),
    )
    .subscribe();
});

onStop(() => {
  subscriptions.forEach(x => x.unsubscribe());
});
