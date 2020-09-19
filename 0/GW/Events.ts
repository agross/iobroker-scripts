import { concat, EMPTY, Observable, of } from 'rxjs';
import {
  distinctUntilKeyChanged,
  filter,
  scan,
  share,
  tap,
} from 'rxjs/operators';

interface Event {
  _IDID: string;
  _date: Date;
  _end: Date;
  event: string; // Summary.
  _section: string; // Description.
  location: string;
  _calName: string;
}

const source = 'ical.0.data.table';
const channelRoot = '0_userdata.0.GW';

const channels: { [channel: string]: (event: Event) => boolean } = {
  'Next Event': event => {
    return event.event.includes('GROSSWEBER');
  },
  'Journey From Home': event => {
    return event.event.startsWith('Journey from Leipzig');
  },
  'Journey To Home': event => {
    return /^Journey\s.*to Leipzig$/.test(event.event);
  },
};

const states = {
  summary: {
    name: 'Event summary',
    type: 'string',
    source: (event: Event) => {
      return event.event;
    },
  },
  location: {
    name: 'Event location',
    type: 'string',
    source: (event: Event) => {
      return event.location;
    },
  },
  computed_location: {
    name: 'Computed event location',
    type: 'string',
    source: undefined,
  },
  start: {
    name: 'Start date',
    type: 'object',
    source: (event: Event) => {
      return new Date(event._date);
    },
  },
  end: {
    name: 'End date',
    type: 'object',
    source: (event: Event) => {
      return new Date(event._end);
    },
  },
  description: {
    name: 'Event description',
    type: 'string',
    source: (event: Event) => {
      return event._section;
    },
  },
};

function channelId(channel: string): string {
  return `${channelRoot}.${channel}`;
}

const allStatesCreated = Object.entries(channels).map(
  async ([channel, _filter]) => {
    const id = channelId(channel);

    await setObjectAsync(id, {
      type: 'channel',
      common: { name: 'Next Event' },
      native: {},
    });
    log(`Created channel ${id}`);

    const statesCreated = Object.entries(states).map(async ([state, def]) => {
      const id = `${channelId(channel)}.${state}`;

      const common = {
        name: def.name,
        read: true,
        write: false,
        role: 'value',
        type: def.type as iobJS.CommonType,
        custom: {
          'lovelace.0': {
            enabled: true,
            entity: 'sensor',
            name: `${channel} ${state}`,
          },
        },
      };

      await setObjectAsync(id, {
        type: 'state',
        common: common,
        native: {},
      });
      log(`Created state ${id}`);
    });

    return Promise.all(statesCreated);
  },
);

function initialEvents(): Observable<Event> {
  const table = getState(source);

  if (table.notExist) {
    return EMPTY;
  }

  return of(...(table.val as Event[]));
}

const eventUpdates = new Observable<Event>(observer => {
  on({ id: source, change: 'ne', ack: true }, event => {
    const events: Event[] = event.state.val;

    events.forEach(e => observer.next(e));
  });
}).pipe(share());

const events = concat(initialEvents(), eventUpdates);

const streams = Object.entries(channels).map(([channel, eventFilter]) => {
  return events.pipe(
    filter(event => eventFilter(event)),
    scan((closestEvent, candidate) => {
      if (!closestEvent) {
        // Initial candidate.
        return candidate;
      }

      if (closestEvent._end < new Date()) {
        // Closest event has passed.
        return candidate;
      }

      if (closestEvent._date < candidate._date) {
        // Candidate starts later than closest event.
        return closestEvent;
      }

      return candidate;
    }),
    filter(event => event !== undefined),
    distinctUntilKeyChanged('_IDID'),
    tap((event: Event) => {
      log(`New event for ${channel}: ${event.event}`);
    }),
    tap((event: Event) => {
      Object.entries(states).forEach(([state, def]) => {
        if (def.source)
          setState(`${channelId(channel)}.${state}`, def.source(event), true);
      });
    }),
  );
});

Promise.all(allStatesCreated).then(() => {
  log('Subscribing to events');

  const subscriptions = streams.map(stream => stream.subscribe());

  onStop(() =>
    subscriptions.forEach(subscription => subscription.unsubscribe()),
  );
});
