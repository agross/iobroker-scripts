import got from 'got';
import { timer } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

const config = {
  stateId: ['0_userdata.0', 'crunch-fit-popular-times'],
  intervalInMs: 3600000 / 3, // 20 min
  query: 'http://crunchfit:5000/',
};

await ObjectCreator.create(
  {
    [config.stateId[1]]: {
      type: 'state',
      common: {
        name: 'Crunch Fit Popular Times',
        type: 'string',
        def: '{}',
        read: true,
        write: false,
        role: 'json',
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'sensor',
            name: 'Crunch_Fit_Popular_Times',
          },
        },
      } as iobJS.StateCommon,
      native: {},
    },
  },
  config.stateId[0],
);

const stateId = config.stateId.join('.');

const update = timer(0, config.intervalInMs)
  .pipe(
    filter(_ => !compareTime('0:30', '5:30', 'between')),
    map(async _ => (await got(config.query).json()) as any),
    tap(async data =>
      log(
        `Queried Crunch Fit popular times: ${JSON.stringify(
          await data,
          undefined,
          2,
        )}`,
        'debug',
      ),
    ),
    map(async data => {
      const now = new Date();
      const weekday = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const dow = weekday[now.getDay()];

      const d = (await data) as {
        current_popularity: number;
        populartimes: { name: string; data: number[] }[];
      };

      const maxPopularity = Math.max(
        ...d.populartimes.map(x => Math.max(...x.data)),
      );

      const popularTimesToday = d.populartimes.find(x => x.name === dow).data;
      if (!popularTimesToday) {
        throw new Error(
          `Could not find today's (${dow}) data in ${JSON.stringify(
            d.populartimes,
          )}`,
        );
      }

      return {
        popularity: popularTimesToday.map((value, index) => {
          return [new Date(now).setHours(index, 0, 0, 0), value];
        }),
        maxPopularity: popularTimesToday.map((_, index) => {
          return [new Date(now).setHours(index, 0, 0, 0), maxPopularity];
        }),
        now: popularTimesToday.map((_, index) => {
          const slot = new Date(new Date(now).setHours(index, 0, 0, 0));

          const current = now.getHours() === slot.getHours();

          return [slot.valueOf(), current ? d.current_popularity : undefined];
        }),
      };
    }),
    tap(async data => {
      const d = await data;

      log(
        `Transformed popular times for Lovelace: ${JSON.stringify(
          d,
          undefined,
          2,
        )}`,
        'debug',
      );

      await setStateAsync(stateId, JSON.stringify(d), true);
    }),
  )
  .subscribe();

onStop(() => {
  [update].forEach(x => x.unsubscribe());
});
