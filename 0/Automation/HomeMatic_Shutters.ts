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
  function deviceId(id: string, initialId?: string): string {
    const _deviceId = id.replace(/\.[^.]*$/, '');
    if (_deviceId == id) {
      return initialId;
    }

    const device = getObject(_deviceId);

    if (!device || device.type !== 'device') {
      // Search parent.
      return deviceId(_deviceId, initialId ? initialId : id);
    }

    return _deviceId;
  }

  function deviceName(id: string): string {
    const device = getObject(deviceId(id));

    if (!device) {
      return id;
    }

    return device.common?.name;
  }

  // HomeMatic shutters.
  return [
    ...$('state[id=*.6.LEVEL]{CONTROL=BLIND_VIRTUAL_RECEIVER.LEVEL}'),
  ].reduce<ObjectDefinitionRoot>((acc, stateId) => {
    const device = deviceId(stateId);

    const deviceStates: {
      [id: string]: iobJS.StateCommon & iobJS.AliasCommon & iobJS.CustomCommon;
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
          'lovelace.0': {
            enabled: true,
            entity: 'input_number',
            name: Lovelace.id(`${deviceName(stateId)} Level`),
          },
        },
      },
      close: {
        alias: {
          id: {
            read: `${device}.4.ACTIVITY_STATE`,
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
          'lovelace.0': {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${deviceName(stateId)} Close`),
          },
        },
      },
      open: {
        alias: {
          id: {
            read: `${device}.4.ACTIVITY_STATE`,
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
          'lovelace.0': {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${deviceName(stateId)} Open`),
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
          'lovelace.0': {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${deviceName(stateId)} Stop`),
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
          'lovelace.0': {
            enabled: true,
            entity: 'input_number',
            name: Lovelace.id(`${deviceName(stateId)} Tilt Level`),
          },
        },
      },
      tilt_close: {
        alias: {
          id: {
            read: `${device}.4.ACTIVITY_STATE`,
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
          'lovelace.0': {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${deviceName(stateId)} Tilt Close`),
          },
        },
      },
      tilt_open: {
        alias: {
          id: {
            read: `${device}.4.ACTIVITY_STATE`,
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
          'lovelace.0': {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${deviceName(stateId)} Tilt Open`),
          },
        },
      },
    };

    acc[device] = {
      type: 'device',
      native: {},
      common: { name: deviceName(stateId), role: 'blind' },
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
    change: 'ne',
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

  const open = stable.pipe(filter(b => b));
  const closed = stable.pipe(filter(b => !b));

  const allowedSlatChanges = desiredSlats.pipe(
    windowToggle(open, _ => closed.pipe(take(1))),
    switchAll(),
  );

  const bufferedSlatChangesWhileUnstable = desiredSlats.pipe(
    bufferToggle(closed, _ => open.pipe(take(1))),
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

        setStateDelayed(setShutterLevel, level.shutter, 200, true, err => {
          log(`${device} level reset to ${level.shutter}: ${err}`);
        });
      }),
    )
    .subscribe();
});

onStop(() => subscriptions.forEach(subscription => subscription.unsubscribe()));
