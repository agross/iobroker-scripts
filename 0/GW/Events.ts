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

function getObjectDefinition(): ObjectDefinitionRoot {
  const stateObjects: (channel: string) => ObjectDefinitionRoot = channel => {
    const channelStates: { [id: string]: any } = {
      summary: {
        name: 'Event summary',
        type: 'string',
        script: {
          source: (event: Event) => {
            return event.event;
          },
        },
      },
      location: {
        name: 'Event location',
        type: 'string',
        script: {
          source: (event: Event) => {
            return event.location;
          },
        },
      },
      computed_location: {
        name: 'Computed event location',
        type: 'string',
      },
      start: {
        name: 'Start date',
        type: 'object',
        script: {
          source: (event: Event) => {
            return new Date(event._date);
          },
        },
      },
      end: {
        name: 'End date',
        type: 'object',
        script: {
          source: (event: Event) => {
            return new Date(event._end);
          },
        },
      },
      description: {
        name: 'Event description',
        type: 'string',
        script: {
          source: (event: Event) => {
            return event._section;
          },
        },
      },
    };

    return Object.entries(channelStates).reduce((acc, [stateId, def]) => {
      acc[stateId] = {
        type: 'state',
        common: {
          name: def.name,
          read: true,
          write: false,
          role: 'value',
          type: def.type as iobJS.CommonType,
          custom: {
            'lovelace.0': {
              enabled: true,
              entity: 'sensor',
              name: `${channel} ${def.name}`,
            },
          },
        },
        native: {},
        script: def.script,
      };

      return acc;
    }, {});
  };

  return {
    'Next Event': {
      type: 'channel',
      common: { name: 'Next Event' },
      native: {},
      nested: stateObjects('Next Event'),
      script: {
        filter: (event: Event) => {
          return event.event.includes('GROSSWEBER');
        },
      },
    },
    'Journey From Home': {
      type: 'channel',
      common: { name: 'Next Journey From Home' },
      native: {},
      nested: stateObjects('Next Journey From Home'),
      script: {
        filter: (event: Event) => {
          return event.event.startsWith('Journey from Leipzig');
        },
      },
    },
    'Journey To Home': {
      type: 'channel',
      common: { name: 'Next Journey To Home' },
      native: {},
      nested: stateObjects('Next Journey To Home'),
      script: {
        filter: (event: Event) => {
          return /^Journey\s.*to Leipzig$/.test(event.event);
        },
      },
    },
  };
}

function channelId(channel: string): string {
  return `${channelRoot}.${channel}`;
}

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

const objects = getObjectDefinition();

const streams = Object.entries(objects).map(([channel, def]) => {
  return events.pipe(
    filter(event => def.script.filter(event)),
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
      Object.entries(def.nested).forEach(([state, def]) => {
        if (!def.script?.source) {
          log(`No source for ${state}`);
          return;
        }

        const stateId = `${channelId(channel)}.${state}`;
        const value = def.script.source(event);

        setState(stateId, value, true, err => {
          if (err) {
            log(`Could not set ${stateId} to ${value}: ${err}`, 'error');
          }
        });
      });
    }),
  );
});

ObjectCreator.create(objects, channelRoot).then(() => {
  log('Subscribing to events');

  const subscriptions = streams.map(stream => stream.subscribe());

  onStop(() =>
    subscriptions.forEach(subscription => subscription.unsubscribe()),
  );
});
