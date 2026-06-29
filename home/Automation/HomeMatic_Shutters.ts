import { merge } from 'rxjs';
import {
  bufferToggle,
  distinctUntilChanged,
  filter,
  map,
  share,
  switchAll,
  take,
  tap,
  windowToggle,
  withLatestFrom,
} from 'rxjs/operators';

function getUserDataObjectDefinition(baseId: string): ObjectDefinitionRoot {
  return [
    ...$('state[id=*.4.COMBINED_PARAMETER]{ID=COMBINED_PARAMETER}'),
  ].reduce<ObjectDefinitionRoot>((acc, stateId) => {
    const device = Device.id(stateId);
    const name = Device.deviceName(stateId);

    const deviceStates: {
      [id: string]: iobJS.StateCommon;
    } = {
      combined: {
        role: 'level.blind',
        type: 'string',
        name: `${name}: Combined parameter of L=<height>,L2=<slats>`,
        read: true,
        write: true,
      },
    };

    acc[device] = {
      type: 'device',
      native: {},
      common: { name: Device.deviceName(stateId), role: 'blind' },
      enumIds: ObjectCreator.getEnumIds(stateId, 'rooms', 'functions'),
      nested: Object.entries(deviceStates).reduce((acc, [id, common]) => {
        acc[id] = { type: 'state', native: {}, common: common };
        return acc;
      }, {} as ObjectDefinitionRoot),
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

function getObjectDefinition(baseId: string): ObjectDefinitionRoot {
  // HomeMatic shutters.
  return [
    ...$('state[id=*.3.LEVEL]{CONTROL=BLIND_TRANSMITTER.LEVEL}'),
  ].reduce<ObjectDefinitionRoot>((acc, stateId) => {
    const device = Device.id(stateId);
    const name = Device.deviceName(stateId);

    const deviceStates: {
      [id: string]: iobJS.StateCommon;
    } = {
      combined: {
        alias: {
          id: {
            read: `0_userdata.0.${device}.3.COMBINED_PARAMETER`,
            write: `${device}.4.COMBINED_PARAMETER`,
          },
        },
        role: 'level.blind',
        type: 'string',
        name: `${name}: Combined parameter of L=<height>,L2=<slats>`,
        read: true,
        write: true,
      },
      level: {
        alias: {
          id: { read: `${device}.3.LEVEL`, write: `${device}.4.LEVEL` },
          read: 'Math.round(val)',
          write: 'val',
        },
        role: 'level.blind',
        type: 'number',
        unit: '%',
        min: 0,
        max: 100,
        name: `${name}: Level of shutters`,
        read: true,
        write: true,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'input_number',
            name: Lovelace.id(`${Device.deviceName(stateId)} Level`),
            attr_icon: 'mdi:window-shutter',
          },
        },
      },
      close: {
        alias: {
          id: {
            read: `${device}.3.ACTIVITY_STATE`,
            write: `${device}.4.LEVEL`,
          },
          read: `val === 2`,
          write: 'val = 0',
        },
        role: 'button.close.blind',
        type: 'boolean',
        name: `${name}: Close shutters completely`,
        read: true,
        write: true,
        def: false,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${Device.deviceName(stateId)} Close`),
            attr_icon: 'mdi:arrow-down',
          },
        },
      },
      open: {
        alias: {
          id: {
            read: `${device}.3.ACTIVITY_STATE`,
            write: `${device}.4.LEVEL`,
          },
          read: `val === 1`,
          write: 'val = 100',
        },
        role: 'button.open.blind',
        type: 'boolean',
        name: `${name}: Open shutters completely`,
        read: true,
        write: true,
        def: false,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${Device.deviceName(stateId)} Open`),
            attr_icon: 'mdi:arrow-up',
          },
        },
      },
      stop: {
        alias: {
          id: { read: `${device}.3.PROCESS`, write: `${device}.4.STOP` },
          read: 'false',
          write: 'true',
        },
        role: 'button.stop.blind',
        type: 'boolean',
        name: `${name}: Stop movement`,
        read: true,
        write: true,
        def: false,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${Device.deviceName(stateId)} Stop`),
            attr_icon: 'mdi:stop',
          },
        },
      },
      tilt_level: {
        alias: {
          id: { read: `${device}.3.LEVEL_2`, write: `${device}.4.LEVEL_2` },
          read: 'Math.round(val)',
          write: 'val',
        },
        role: 'level.tilt',
        type: 'number',
        unit: '%',
        min: 0,
        max: 100,
        name: `${name}: Tilt level of slats`,
        read: true,
        write: true,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'input_number',
            name: Lovelace.id(`${Device.deviceName(stateId)} Tilt Level`),
            attr_icon: 'mdi:angle-acute',
          },
        },
      },
      tilt_close: {
        alias: {
          id: {
            read: `${device}.3.ACTIVITY_STATE`,
            write: `${device}.4.LEVEL_2`,
          },
          read: `val === 2`,
          write: 'val = 0',
        },
        role: 'button.close.tilt',
        type: 'boolean',
        name: `${name}: Close slats`,
        read: true,
        write: true,
        def: false,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${Device.deviceName(stateId)} Tilt Close`),
            attr_icon: 'mdi:arrow-down',
          },
        },
      },
      tilt_open: {
        alias: {
          id: {
            read: `${device}.3.ACTIVITY_STATE`,
            write: `${device}.4.LEVEL_2`,
          },
          read: `val === 1`,
          write: 'val = 100',
        },
        role: 'button.open.tilt',
        type: 'boolean',
        name: `${name}: Open slats`,
        read: true,
        write: true,
        def: false,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${Device.deviceName(stateId)} Tilt Open`),
            attr_icon: 'mdi:arrow-up',
          },
        },
      },
    };

    acc[device] = {
      type: 'device',
      native: {},
      common: { name: Device.deviceName(stateId), role: 'blind' },
      enumIds: ObjectCreator.getEnumIds(stateId, 'rooms', 'functions'),
      nested: Object.entries(deviceStates).reduce((acc, [id, common]) => {
        acc[id] = { type: 'state', native: {}, common: common };
        return acc;
      }, {} as ObjectDefinitionRoot),
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

await ObjectCreator.create(
  getUserDataObjectDefinition('0_userdata.0'),
  '0_userdata.0',
);

await ObjectCreator.create(getObjectDefinition('alias.0'), 'alias.0');

// When only slats tilt is set we also need to re-set the current level,
// otherwise the new slats tilt is not applied. Wait until the shutter stopped
// moving before reapplying the level.
const subscriptions = [
  ...$('state[id=*.4.LEVEL_2]{CONTROL=BLIND_VIRTUAL_RECEIVER.LEVEL_2}'),
].flatMap(slatsState => {
  const device = slatsState.replace(/\.4\.LEVEL_2$/, '');
  const stableState = `${device}.4.PROCESS`;
  const setShutterLevel = `${device}.4.LEVEL`;
  const getCombinedLevel = `0_userdata.0.${device}.3.COMBINED_PARAMETER`;
  const getShutterLevel = `${device}.3.LEVEL`;
  const getSlatsLevel = `${device}.3.LEVEL_2`;

  createState(getCombinedLevel, {
    name: 'COMBINED_PARAMETER from LEVEL and LEVEL_2',
    type: 'string',
  });

  const shutter = new Stream<number>(getShutterLevel).stream;
  const slats = new Stream<number>(getSlatsLevel).stream;

  const desiredSlats = new Stream<number>({
    id: slatsState,
    ack: false,
  }).stream.pipe(
    tap(slats => log(`${device} desired slats ${slats}`)),
    share(),
  );

  const stable = new Stream<number>(stableState).stream.pipe(
    map(val => val === 0),
    distinctUntilChanged(),
    tap(stable => log(`${device} stable: ${stable}`)),
    share(),
  );

  const setCombined = stable
    .pipe(
      filter(x => x === true),
      withLatestFrom(shutter, slats, (_, shutter, slats) => {
        return { shutter: shutter, slats: slats };
      }),
      tap(x =>
        setState(
          getCombinedLevel,
          `L=${x.shutter},L2=${x.slats}`,
          true,
          err => {
            if (err) {
              log(`Error setting combined data: ${err}`, 'error');
            }
          },
        ),
      ),
    )
    .subscribe();

  const isStable = stable.pipe(
    filter(b => b),
    share(),
  );
  const isUnstable = stable.pipe(
    filter(b => !b),
    share(),
  );

  const allowedSlatChanges = desiredSlats.pipe(
    windowToggle(isStable, _ => isUnstable.pipe(take(1))),
    switchAll(),
  );

  const bufferedSlatChangesWhileUnstable = desiredSlats.pipe(
    bufferToggle(isUnstable, _ => isStable.pipe(take(1))),
    map(buffered => buffered.pop()),
    filter(slats => Number.isInteger(slats)),
  );

  const slatsWithShutterLevel = merge(
    allowedSlatChanges,
    bufferedSlatChangesWhileUnstable,
  )
    .pipe(
      withLatestFrom(shutter, (slats, shutter) => {
        return { slats: slats, shutter: shutter };
      }),
      tap(level => {
        log(
          `${device} is stable, setting slats to ${level.slats} by resetting shutter to ${level.shutter}`,
        );

        setState(setShutterLevel, level.shutter, false, err => {
          if (err)
            log(
              `${device} failed to reset shutter to ${level.shutter}: ${err}`,
            );
        });
      }),
    )
    .subscribe();

  return [setCombined, slatsWithShutterLevel];
});

onStop(() => subscriptions.forEach(subscription => subscription.unsubscribe()));
