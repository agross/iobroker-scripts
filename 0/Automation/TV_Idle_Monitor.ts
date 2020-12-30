import { timer } from 'rxjs';
import { filter, map, switchMap, tap } from 'rxjs/operators';

const script = 'script.js.Automation.TV_Idle';
const scriptStatus = 'javascript.0.scriptEnabled.Automation.TV_Idle';
const reenableAfter = 5;

const reenableTvIdle = new Stream<boolean>(scriptStatus).stream
  .pipe(filter(state => state === false))
  .pipe(
    map(_ => {
      const now = new Date();
      return new Date(now.setHours(now.getHours() + reenableAfter));
    }),
  )
  .pipe(
    tap(on => Notify.tv(`TV Idle turns back on at: ${on.toLocaleString()}`)),
  )
  .pipe(switchMap(on => timer(on)))
  .pipe(tap(async _ => await startScriptAsync(script, true)))
  .subscribe();

onStop(() => reenableTvIdle.unsubscribe());
