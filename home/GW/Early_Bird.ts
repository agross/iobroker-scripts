import { combineLatest, EMPTY, timer } from 'rxjs';
import { filter, first, map, switchMap, tap } from 'rxjs/operators';

const config = {
  heatingPeriod: 'hm-rega.0.2322',
  departureAt: '0_userdata.0.GW.Journey From Home.start',
  heatingStartsAt: (departure: Date) => {
    const r = new Date(departure);
    r.setHours(r.getHours() - 2);
    return r;
  },
  bathroomHeating: 'hm-rpc.1.000C9A499EE42F.1',
};

const heatingPeriod = new Stream<boolean>(config.heatingPeriod).stream;
const departures = new Stream<string>(config.departureAt).stream;

const subscription = combineLatest([departures, heatingPeriod])
  .pipe(
    map(([departure, _heatingPeriod]) => departure),
    switchMap(date => {
      if (!date) {
        Notify.mobile('No scheduled departure');

        return EMPTY;
      }

      const departure = new Date(date);
      if (departure.getHours() >= 9) {
        return EMPTY;
      }

      const dueDate = config.heatingStartsAt(departure);

      if (dueDate < new Date()) {
        Notify.mobile(
          `Scheduled heating for ${dueDate.formatDateTime()} is in the past, skipping`,
        );

        return EMPTY;
      }

      Notify.mobile(
        `Scheduling bathroom heating for ${dueDate.formatDateTime()} (departure at ${departure.formatDateTime()})`,
      );

      return timer(dueDate).pipe(
        map(_ => [departure, dueDate]),
        first(),
      );
    }),
    tap(([departure, _dueDate]) => {
      Notify.mobile(
        `Heating bathroom for departure at ${departure.formatDateTime()}`,
      );

      setState(`${config.bathroomHeating}.SET_POINT_TEMPERATURE`, 22);
      setState(`${config.bathroomHeating}.SET_POINT_MODE`, 0);
    }),
  )
  .subscribe();

onStop(() => {
  subscription.unsubscribe();
});
