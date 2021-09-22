import { iif, of } from 'rxjs';
import {
  distinctUntilKeyChanged,
  filter,
  map,
  scan,
  switchMap,
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
      start: {
        name: 'Start date',
        type: 'string',
        device_class: 'timestamp',
        script: {
          source: (event: Event) => {
            return formatDate(new Date(event._date), 'YYYY-MM-DD hh:mm');
          },
        },
      },
      end: {
        name: 'End date',
        type: 'string',
        device_class: 'timestamp',
        script: {
          source: (event: Event) => {
            return formatDate(new Date(event._end), 'YYYY-MM-DD hh:mm');
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
              name: Lovelace.id(`${channel} ${def.name}`),
              attr_device_class: def.device_class,
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
          return (
            event.event.includes('GROSSWEBER') &&
            event.location &&
            event.location.length > 0
          );
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
          return /^Journey\s.*to Leipzig/.test(event.event);
        },
      },
    },
  };
}

function channelId(channel: string): string {
  return `${channelRoot}.${channel}`;
}

const events = new Stream<Event[]>(source).stream;

const objects = getObjectDefinition();

const streams = Object.entries(objects).map(([channel, def]) => {
  return events.pipe(
    map(events => events.filter(event => def.script.filter(event))),
    switchMap(events => {
      const removeEventData = of(1).pipe(
        tap(_ => {
          log(`No events for ${channel}, removing`);

          Object.entries(def.nested).forEach(([state, def]) => {
            const stateId = `${channelId(channel)}.${state}`;
            const type = (def.common as iobJS.StateCommon).type;
            let value = undefined;

            switch (type) {
              case 'string':
                value = '';
                break;

              case 'object':
                value = null;
                break;

              default:
                throw new Error(`Unsupported type ${type} for ${stateId}`);
            }

            setState(stateId, value, true, err => {
              if (err) {
                log(`Could not reset ${stateId} to ${value}: ${err}`, 'error');
              }
            });
          });
        }),
      );

      const setEventData = of(...events).pipe(
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

      return iif(() => events.length === 0, removeEventData, setEventData);
    }),
  );
});

await ObjectCreator.create(objects, channelRoot);

log('Subscribing to events');
const subscriptions = streams.map(stream => stream.subscribe());

onStop(() => subscriptions.forEach(subscription => subscription.unsubscribe()));
