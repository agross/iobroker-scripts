import { combineLatest } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

const config = { adapter: 'ecovacs-deebot.*' };

const deebots = [
  ...new Set(
    [...$(`channel[id=${config.adapter}][state.id=*.status.device]`)].map(x =>
      x.replace(/^([\w-]+\.\d+)\..*/, '$1'),
    ),
  ),
].map(root => {
  return {
    root: root,
    name: getState(`${root}.info.deviceModel`).val,
  };
});

const deebotUserStates = deebots.reduce((acc, deebot) => {
  const spotAreas = [
    ...$(`state[id=${deebot.root}.control.spotArea_*][role=button]`),
  ]
    .map(spotAreaId => ({
      spotAreaId: spotAreaId,
      schedulerId: spotAreaId.replace(/_\d+$/, ''),
      object: getObject(spotAreaId),
    }))
    .filter(spotArea => spotArea.object.common.name.length > 1)
    .reduce((acc, spotArea) => {
      const areaName = spotArea.object.common.name;

      acc[areaName] = {
        type: 'state',
        common: {
          name: areaName,
          role: 'state',
          type: 'boolean',
          read: true,
          write: true,
          def: false,
          custom: {
            [AdapterIds.lovelace]: {
              enabled: true,
              entity: 'input_boolean',
              name: Lovelace.id(`Schedule Clean ${areaName}`),
              attr_icon: 'mdi:broom',
              attr_friendly_name: areaName,
            },
          },
        },
        native: {
          sourcedFrom: spotArea.spotAreaId,
          schedulerId: spotArea.schedulerId,
          areaIndex: spotArea.spotAreaId.match(/spotArea_(\d)+$/)[1],
        },
      };

      return acc;
    }, {} as ObjectDefinitionRoot);

  const customAreaScheduler = `${deebot.root}.control.customArea`;

  const customAreas = {
    Kitchenette: {
      type: 'state',
      common: {
        name: 'Kitchenette',
        role: 'state',
        type: 'boolean',
        read: true,
        write: true,
        def: false,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'input_boolean',
            name: Lovelace.id('Schedule Clean Kitchenette'),
            attr_icon: 'mdi:broom',
            attr_friendly_name: 'Kitchenette',
          },
        },
      },
      native: {
        schedulerId: customAreaScheduler,
        coordinates: '1500,-2575,2575,1200',
      },
    },
    Dining: {
      type: 'state',
      common: {
        name: 'Dining',
        role: 'state',
        type: 'boolean',
        read: true,
        write: true,
        def: false,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'input_boolean',
            name: Lovelace.id('Schedule Clean Dining'),
            attr_icon: 'mdi:broom',
            attr_friendly_name: 'Dining',
          },
        },
      },
      native: {
        schedulerId: customAreaScheduler,
        coordinates: '2875,1600,5700,-550',
      },
    },
    Entrance: {
      type: 'state',
      common: {
        name: 'Entrance',
        role: 'state',
        type: 'boolean',
        read: true,
        write: true,
        def: false,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'input_boolean',
            name: Lovelace.id('Schedule Clean Entrance'),
            attr_icon: 'mdi:broom',
            attr_friendly_name: 'Entrance',
          },
        },
      },
      native: {
        schedulerId: customAreaScheduler,
        coordinates: '4200,-110,6800,-2400',
      },
    },
    'Living Room Table': {
      type: 'state',
      common: {
        name: 'Kitchenette',
        role: 'state',
        type: 'boolean',
        read: true,
        write: true,
        def: false,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'input_boolean',
            name: Lovelace.id('Schedule Clean Living Room Table'),
            attr_icon: 'mdi:broom',
            attr_friendly_name: 'Living Room Table',
          },
        },
      },
      native: {
        schedulerId: customAreaScheduler,
        coordinates: '2500,-5000,3575,-4000',
      },
    },
    'Bathroom Vanity': {
      type: 'state',
      common: {
        name: 'Bathroom Vanity',
        role: 'state',
        type: 'boolean',
        read: true,
        write: true,
        def: false,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'input_boolean',
            name: Lovelace.id('Schedule Clean Bathroom Vanity'),
            attr_icon: 'mdi:broom',
            attr_friendly_name: 'Bathroom Vanity',
          },
        },
      },
      native: {
        schedulerId: customAreaScheduler,
        coordinates: '7895,16,9573,-1394',
      },
    },
  } as ObjectDefinitionRoot;

  acc[deebot.root] = {
    type: 'device',
    native: {},
    common: { name: deebot.name, role: 'device' },
    nested: {
      'Scheduled Spot Areas': {
        type: 'channel',
        common: { name: 'Spot areas scheduled to be cleaned' },
        native: {},
        nested: spotAreas,
      },
      'clean-scheduled-spot-areas': {
        type: 'state',
        common: {
          name: 'Clean scheduled spot areas',
          type: 'boolean',
          role: 'state',
          read: true,
          write: true,
          def: false,
          custom: {
            [AdapterIds.lovelace]: {
              enabled: true,
              entity: 'scene',
              name: Lovelace.id('Clean Scheduled Spot Areas'),
              attr_device_class: 'script',
              attr_icon: 'mdi:broom',
            },
          },
        },
        native: {},
      },
      'Scheduled Custom Areas': {
        type: 'channel',
        common: { name: 'Custom areas to be cleaned' },
        native: {},
        nested: customAreas,
      },
      'clean-scheduled-custom-areas': {
        type: 'state',
        common: {
          name: 'Clean scheduled custom areas',
          type: 'boolean',
          role: 'state',
          read: true,
          write: true,
          def: false,
          custom: {
            [AdapterIds.lovelace]: {
              enabled: true,
              entity: 'scene',
              name: Lovelace.id('Clean Scheduled Custom Areas'),
              attr_device_class: 'script',
              attr_icon: 'mdi:broom',
            },
          },
        },
        native: {},
      },
    },
  };

  return acc;
}, {} as ObjectDefinitionRoot);

await ObjectCreator.create(deebotUserStates, '0_userdata.0');

const acknowledge = [
  ...$(`state[id=0_userdata.0.${config.adapter}.Scheduled Spot Areas.*]`),
  ...$(`state[id=0_userdata.0.${config.adapter}.clean-scheduled-spot-areas]`),
  ...$(`state[id=0_userdata.0.${config.adapter}.Scheduled Custom Areas.*]`),
  ...$(`state[id=0_userdata.0.${config.adapter}.clean-scheduled-custom-areas]`),
].map(area => {
  return new Stream<iobJS.ChangedStateObject>(
    { id: area, ack: false },
    { map: event => event },
  ).stream
    .pipe(tap(state => setState(area, state.state.val, true)))
    .subscribe();
});

const spotAreas = [
  ...$(`state[id=0_userdata.0.${config.adapter}.Scheduled Spot Areas.*]`),
].map(spotArea => {
  log(`Subscribing to scheduled spot area: ${spotArea}`);

  return new Stream<boolean>(spotArea).stream.pipe(
    distinctUntilChanged(),
    map(scheduled => {
      const native = getObject(spotArea).native;

      return {
        id: spotArea,
        scheduled: scheduled,
        scheduleAreaIndex: native.areaIndex,
        schedulerId: native.schedulerId,
      };
    }),
  );
});

const scheduledSpotAreas = combineLatest(spotAreas).pipe(
  map(spotAreas => spotAreas.filter(spotArea => spotArea.scheduled)),
  tap(spotAreas =>
    log(`Scheduled spot areas: ${spotAreas.map(s => s.id).join(', ')}`),
  ),
);

const cleanSpotAreas = [
  ...$(`state[id=0_userdata.0.${config.adapter}.clean-scheduled-spot-areas]`),
].map(clean => {
  return new Stream(clean, {
    map: event => {
      return {
        id: event.id,
        value: event.state.val,
      };
    },
  }).stream
    .pipe(
      filter(x => x.value === true),
      withLatestFrom(scheduledSpotAreas),
      tap(([trigger, spotAreas]) => {
        // Reset schedule.
        [trigger.id, ...spotAreas.map(s => s.id)].forEach(id =>
          setState(id, false, true),
        );
      }),
      map(([_trigger, spotAreas]) =>
        spotAreas.reduce((acc, spotArea) => {
          if (!acc[spotArea.schedulerId]) {
            acc[spotArea.schedulerId] = [];
          }

          acc[spotArea.schedulerId].push(spotArea.scheduleAreaIndex);

          return acc;
        }, {}),
      ),
      tap(targets => {
        for (const target in targets) {
          const areaIds = targets[target].sort().join(',');

          console.log(`Scheduling ${target} with areas ${areaIds}`);
          setState(target, areaIds);
        }
      }),
    )
    .subscribe();
});

const customAreas = [
  ...$(`state[id=0_userdata.0.${config.adapter}.Scheduled Custom Areas.*]`),
].map(customArea => {
  log(`Subscribing to scheduled custom area: ${customArea}`);

  return new Stream<boolean>(customArea).stream.pipe(
    distinctUntilChanged(),
    map(scheduled => {
      const native = getObject(customArea).native;

      return {
        id: customArea,
        scheduled: scheduled,
        coordinates: native.coordinates,
        schedulerId: native.schedulerId,
      };
    }),
  );
});

const scheduledCustomAreas = combineLatest(customAreas).pipe(
  map(customAreas => customAreas.filter(customArea => customArea.scheduled)),
  tap(customAreas =>
    log(`Scheduled custom areas: ${customAreas.map(s => s.id).join(', ')}`),
  ),
);

const cleanCustomAreas = [
  ...$(`state[id=0_userdata.0.${config.adapter}.clean-scheduled-custom-areas]`),
].map(clean => {
  return new Stream(clean, {
    map: event => {
      return {
        id: event.id,
        value: event.state.val,
      };
    },
  }).stream
    .pipe(
      filter(x => x.value === true),
      withLatestFrom(scheduledCustomAreas),
      tap(([trigger, customAreas]) => {
        // Reset schedule.
        [trigger.id, ...customAreas.map(s => s.id)].forEach(id =>
          setState(id, false, true),
        );
      }),
      map(([_trigger, customAreas]) =>
        customAreas.reduce((acc, customArea) => {
          if (!acc[customArea.schedulerId]) {
            acc[customArea.schedulerId] = [];
          }

          acc[customArea.schedulerId].push(customArea.coordinates);

          return acc;
        }, {}),
      ),
      tap(targets => {
        for (const target in targets) {
          const coordinates = targets[target].join(';');

          console.log(`Scheduling ${target} with coordinates ${coordinates}`);
          setState(target, coordinates);
        }
      }),
    )
    .subscribe();
});

onStop(() =>
  [...acknowledge, ...cleanSpotAreas, ...cleanCustomAreas].forEach(
    subscription => subscription.unsubscribe(),
  ),
);
