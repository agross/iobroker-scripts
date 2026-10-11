import { timer } from 'rxjs';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { Temporal } from 'temporal-polyfill';

const config = {
  script: 'script.js.Automation.TV_Idle',
  scriptStatus: 'javascript.0.scriptEnabled.Automation.TV_Idle',
  reenableAfter: Temporal.Duration.from({ hours: 5 }),
};

const reenableTvIdle = new Stream<boolean>(config.scriptStatus).stream
  .pipe(
    filter(state => state === false),
    map(_ => Temporal.Now.instant().add(config.reenableAfter)),
    map(on => new Date(on.epochMilliseconds)),
    tap(on => Notify.tv(`TV Idle turns back on at: ${Format.dateTime(on)}`)),
    switchMap(on => timer(on)),
    tap(async _ => await startScriptAsync(config.script, true)),
  )
  .subscribe();

onStop(() => reenableTvIdle.unsubscribe());
