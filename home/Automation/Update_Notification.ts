import { filter, map, pairwise, startWith, tap } from 'rxjs/operators';

const config = {
  indicator: 'admin.0.info.updatesJson',
};

const updates = new Stream<string>(config.indicator).stream
  .pipe(
    map(json => JSON.parse(json)),
    map(json => Object.keys(json)),
    startWith(new Array<string>()),
    pairwise(),
    map(([prev, next]) => {
      const prevAsSet = new Set([...prev]);
      const newUpdates = [...next].filter(x => !prevAsSet.has(x));

      return newUpdates.sort();
    }),
    filter(adapters => adapters.length > 0),
    tap(adapters => {
      const updates = adapters.join(', ');

      Notify.mobile(`New updates available: ${updates}`);
    }),
  )
  .subscribe();

onStop(() => updates.unsubscribe());
