import { Observable, combineLatest, merge } from 'rxjs';
import {
  distinctUntilKeyChanged,
  filter,
  groupBy,
  map,
  mergeMap,
  scan,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

const config = {
  override: ['0_userdata.0', 'Brightness'],
  globalState: () => `${config.override.join('.')}.global`,
  remote: 'hm-rpc.1.000B5A49A07F8D',
  change: 5,
};

interface Room {
  id: string;
  name: string;
  members: string[];
}

const rooms = (getEnums('rooms') as Room[]).map(x => ({
  ...x,
  ...{ id: x.id.replace(/^enum\.rooms\./, '') },
}));
const lights = [
  ...$('state[role=level.dimmer][id=*.brightness](functions=light)'),
].map((x: string) => x.replace(/\.brightness$/, ''));

const roomsToLights = {
  global: { name: 'Global', lights: lights },
  ...rooms
    .map(x => ({
      ...x,
      ...{ lights: x.members.filter(x => lights.includes(x)) },
    }))
    .filter(x => x.lights.length > 0)
    .reduce((acc, x) => {
      acc[x.id] = {
        name: x.name,
        lights: x.lights,
      };

      return acc;
    }, {}),
};

const lightsToRooms: { [id: string]: string[] } = lights.reduce((acc, el) => {
  acc[el] = [
    'global',
    ...rooms.filter(x => x.members.includes(el)).map(x => x.id),
  ];
  return acc;
}, {});

function getObjectDefinition(): ObjectDefinitionRoot {
  const template = (name: string) => ({
    type: 'state',
    common: {
      name: name,
      type: 'number',
      def: 50,
      read: true,
      write: true,
      role: 'level.dimmer',
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'input_number',
          name: Lovelace.id(name),
          min: 0,
          max: 100,
          step: 1,
          attr_icon: 'mdi:lightbulb-on-outline',
        },
      },
    } as iobJS.StateCommon,
    native: {},
  });

  const overrides = Object.entries(roomsToLights).reduce((acc, [k, v]) => {
    acc[k] = template(`${v.name} Brightness`);
    return acc;
  }, {});

  return {
    [config.override[1]]: {
      type: 'channel',
      common: { name: 'Brightness' },
      native: {},
      nested: overrides,
    },
  } as ObjectDefinitionRoot;
}

await ObjectCreator.create(getObjectDefinition(), config.override[0]);

interface LightStateAndBrightness {
  id: string;
  on: boolean;
  brightness: number;
  rooms: string[];
}

const brightness$: Observable<LightStateAndBrightness>[] = lights.map(id => {
  const state = `${id}.state`;
  const brightness = `${id}.brightness`;

  log(
    `Monitoring ${id}: brightness=${getState(brightness).val} state=${
      getState(state).val ? 'on' : 'off'
    }`,
  );

  const brightness$ = new Stream(brightness, {
    map: ev => ev.state.val as number,
  }).stream;

  const state$ = new Stream(state, {
    map: ev => ev.state.val as boolean,
  }).stream;

  return combineLatest([brightness$, state$]).pipe(
    map(([brightness, state]) => ({
      id: id,
      on: state,
      brightness: brightness,
      rooms: lightsToRooms[id],
    })),
  );
});

interface BrightnessByRoom {
  [roomId: string]: {
    minBrightness: number;
    brightnesses: { [deviceId: string]: LightStateAndBrightness };
  };
}

const minimumBrightnessByRoom = merge(...brightness$)
  .pipe(
    scan((acc: BrightnessByRoom, el) => {
      el.rooms.forEach(room => {
        if (!acc[room]) acc[room] = { minBrightness: 100, brightnesses: {} };

        acc[room].brightnesses[el.id] = el;

        const brightnessOfLightsTurnedOn = Object.values(acc[room].brightnesses)
          .filter(x => x.on)
          .map(x => x.brightness);

        if (brightnessOfLightsTurnedOn.length) {
          acc[room].minBrightness = Math.min(...brightnessOfLightsTurnedOn);
        } else {
          acc[room].minBrightness = 0;
        }
      });

      return acc;
    }, {}),
    mergeMap((x: BrightnessByRoom) => {
      return Object.entries(x).map(([room, brightness]) => ({
        room: room,
        min: brightness.minBrightness,
      }));
    }),
    groupBy(x => x.room),
    mergeMap(room => room.pipe(distinctUntilKeyChanged('min'))),
    tap(group => {
      log(
        `Minimum brightness of lights turned on in room ${group.room}: ${group.min}`,
      );

      setState(`${config.override.join('.')}.${group.room}`, group.min, true);
    }),
  )
  .subscribe();

interface LightsTurnedByRoom {
  [roomId: string]: string[];
}

const lightsTurnedOnByRoom = combineLatest(brightness$).pipe(
  map(brightnesses =>
    brightnesses
      .filter(x => x.on)
      .reduce((acc, el) => {
        el.rooms.forEach(room => {
          if (!acc[room]) acc[room] = [];

          acc[room].push(el.id);
        });
        return acc;
      }, {} as LightsTurnedByRoom),
  ),
);

const commandsByRoom = Object.keys(
  getObjectDefinition()[config.override[1]].nested,
).map(roomId => {
  const commandState = `${config.override.join('.')}.${roomId}`;

  return new Stream(
    { id: commandState, ack: false },
    {
      map: ev => ({
        room: roomId,
        brightness: ev.state.val as number,
      }),
    },
  ).stream
    .pipe(
      withLatestFrom(lightsTurnedOnByRoom),
      map(([command, lights]) => {
        const affectedLights = lights[command.room];

        return {
          lights: affectedLights || [],
          brightness: command.brightness,
        };
      }),
      tap(x => setState(commandState, x.brightness, true)),
      filter(x => x.lights.length > 0),
      tap(x => {
        log(
          `Setting brightness to ${x.brightness} for ${
            x.lights.length
          } devices: ${x.lights.join(', ')}`,
        );

        x.lights.forEach(light => {
          const brightnessState = `${light}.brightness`;

          if (existsState(brightnessState)) {
            setState(brightnessState, x.brightness);
          }
        });
      }),
    )
    .subscribe();
});

if (existsObject(config.remote)) {
  const globalState$ = new Stream<number>(config.globalState()).stream;

  const darker = new Stream(`${config.remote}.3.PRESS_LONG`, {
    pipe: obs => obs, // All values, not distinct ones.
  }).stream
    .pipe(
      withLatestFrom(globalState$),
      map(([_, global]) => global - config.change),
      map(x => (x < 1 ? 1 : x)),
      tap(x => setState(config.globalState(), x)),
    )
    .subscribe();

  const brighter = new Stream(`${config.remote}.4.PRESS_LONG`, {
    pipe: obs => obs, // All values, not distinct ones.
  }).stream
    .pipe(
      withLatestFrom(globalState$),
      map(([_, global]) => global + config.change),
      map(x => (x > 100 ? 100 : x)),
      tap(x => setState(config.globalState(), x)),
    )
    .subscribe();

  onStop(() => [brighter, darker].forEach(x => x.unsubscribe()));
}

onStop(() =>
  [minimumBrightnessByRoom, ...commandsByRoom].forEach(x => x.unsubscribe()),
);
