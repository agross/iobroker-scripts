import { EMPTY, timer } from 'rxjs';
import { first, map, switchMap, tap } from 'rxjs/operators';

const returningHomeAt = '0_userdata.0.GW.Journey To Home.end';
const presence = 'hm-rega.0.950';

const arrivingAtHome = new Stream<string>(returningHomeAt).stream;

const subscription = arrivingAtHome
  .pipe(
    switchMap(date => {
      if (!date) {
        Notify.mobile('No scheduled presence');

        return EMPTY;
      }

      const arrival = new Date(date);
      const dueDate = new Date(arrival);
      dueDate.setHours(arrival.getHours() - 2);

      if (dueDate < new Date()) {
        Notify.mobile(
          `Scheduled presence ${dueDate.toLocaleString()} is in the past, skipping`,
        );

        return EMPTY;
      }

      Notify.mobile(
        `Scheduling presence for ${dueDate.toLocaleString()} (arrival at ${arrival.toLocaleString()})`,
      );

      return timer(dueDate).pipe(
        map(_ => [arrival, dueDate]),
        first(),
      );
    }),
    tap(([arrival, _dueDate]) => {
      Notify.mobile(
        `Pretending to be at home for arrival at ${arrival.toLocaleString()}`,
      );

      setState(presence, true);
    }),
  )
  .subscribe();

onStop(() => {
  subscription.unsubscribe();
});
