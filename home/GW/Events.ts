import { Observable, of } from 'rxjs';
import {
  distinctUntilChanged,
  distinctUntilKeyChanged,
  map,
  mergeMap,
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

const config = { source: 'ical.0.data.table', channelRoot: '0_userdata.0.GW' };

function getObjectDefinition(): ObjectDefinitionRoot {
  const stateObjects: (channel: string) => ObjectDefinitionRoot = channel => {
    const channelStates: { [id: string]: any } = {
      summary: {
        name: 'Event Summary',
        type: 'string',
        script: {
          source: (event: Event) => {
            return event.event;
          },
        },
      },
      location: {
        name: 'Event Location',
        type: 'string',
        script: {
          source: (event: Event) => {
            return event.location;
          },
        },
      },
      start: {
        name: 'Start Date',
        type: 'mixed',
        device_class: 'timestamp',
        script: {
          source: (event: Event) => {
            return new Date(event._date).toISOString();
          },
        },
      },
      end: {
        name: 'End Date',
        type: 'mixed',
        device_class: 'timestamp',
        script: {
          source: (event: Event) => {
            return new Date(event._end).toISOString();
          },
        },
      },
      description: {
        name: 'Event Description',
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
            [AdapterIds.lovelace]: {
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
      common: { name: 'Next Journey from Home' },
      native: {},
      nested: stateObjects('Next Journey from Home'),
      script: {
        filter: (event: Event) => {
          return (
            event.event.startsWith('Journey from Leipzig') ||
            event.event.startsWith('Fahrt von Leipzig')
          );
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
          return (
            /^Journey\s.*to Leipzig/.test(event.event) ||
            /^Fahrt von\s.*nach Leipzig/.test(event.event)
          );
        },
      },
    },
  };
}

const objects = getObjectDefinition();

const source = new Stream<Event[]>(config.source).stream.pipe(
  distinctUntilChanged((x, y) => JSON.stringify(x) === JSON.stringify(y)),
);

const streams = Object.entries(objects).map(([channel, def]) => {
  const channelEvents = source.pipe(
    map(events => events.filter(event => def.script.filter(event))),
  );

  function channelId(channel: string): string {
    return `${config.channelRoot}.${channel}`;
  }

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

          case 'mixed':
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

  const setEventData = function (events: Observable<Event[]>) {
    return events.pipe(
      mergeMap(x => x),
      scan((closestEvent, candidate) => {
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
      distinctUntilKeyChanged('_IDID'),
      tap(event => {
        log(
          `Next event for ${channel}: ${event.event} on ${event._date} (ID ${event._IDID})`,
        );
      }),
      tap(event => {
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
  };

  return channelEvents.pipe(
    switchMap(events => {
      return events.length === 0 ? removeEventData : setEventData(of(events));
    }),
  );
});

await ObjectCreator.create(objects, config.channelRoot);

log('Subscribing to events');
const subscriptions = streams.map(stream => stream.subscribe());

onStop(() => subscriptions.forEach(subscription => subscription.unsubscribe()));
