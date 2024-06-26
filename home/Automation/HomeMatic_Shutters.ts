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

function getObjectDefinition(): ObjectDefinitionRoot {
  // HomeMatic shutters.
  return [
    ...$('state[id=*.3.LEVEL]{CONTROL=BLIND_TRANSMITTER.LEVEL}'),
  ].reduce<ObjectDefinitionRoot>((acc, stateId) => {
    const device = Device.id(stateId);

    const deviceStates: {
      [id: string]: iobJS.StateCommon;
    } = {
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
        name: 'Level of shutters',
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
        role: 'button.close',
        type: 'boolean',
        name: 'Close shutters completely',
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
        role: 'button.open',
        type: 'boolean',
        name: 'Open shutters completely',
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
        role: 'button.stop',
        type: 'boolean',
        name: 'Stop movement',
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
        role: 'value.blind',
        type: 'number',
        unit: '%',
        min: 0,
        max: 100,
        name: 'Tilt level of slats',
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
        role: 'button.close',
        type: 'boolean',
        name: 'Tilt slats into closed position',
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
        role: 'button.open',
        type: 'boolean',
        name: 'Tilt slats into open position',
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

await ObjectCreator.create(getObjectDefinition(), 'alias.0');

// When only slats tilt is set we also need to re-set the current level,
// otherwise the new slats tilt is not applied. Wait until the shutter stopped
// moving before reapplying the level.
const subscriptions = [
  ...$('state[id=*.4.LEVEL_2]{CONTROL=BLIND_VIRTUAL_RECEIVER.LEVEL_2}'),
].map(slatsState => {
  const device = slatsState.replace(/\.4\.LEVEL_2$/, '');
  const stableState = `${device}.4.PROCESS`;
  const setShutterLevel = `${device}.4.LEVEL`;
  const getShutterLevel = `${device}.3.LEVEL`;

  const shutter = new Stream<number>(getShutterLevel).stream;

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

  return merge(allowedSlatChanges, bufferedSlatChangesWhileUnstable)
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
});

onStop(() => subscriptions.forEach(subscription => subscription.unsubscribe()));
