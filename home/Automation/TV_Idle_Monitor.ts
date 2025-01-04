import { timer } from 'rxjs';
import { filter, map, switchMap, tap } from 'rxjs/operators';

const config = {
  script: 'script.js.Automation.TV_Idle',
  scriptStatus: 'javascript.0.scriptEnabled.Automation.TV_Idle',
  reenableAfter: 5,
};

const reenableTvIdle = new Stream<boolean>(config.scriptStatus).stream
  .pipe(
    filter(state => state === false),
    map(_ => {
      const now = new Date();
      return new Date(now.setHours(now.getHours() + config.reenableAfter));
    }),
    tap(on => Notify.tv(`TV Idle turns back on at: ${Format.dateTime(on)}`)),
    switchMap(on => timer(on)),
    tap(async _ => await startScriptAsync(config.script, true)),
  )
  .subscribe();

onStop(() => reenableTvIdle.unsubscribe());
