import { merge, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, map, tap } from 'rxjs/operators';

type AliasDeviceConfig = {
  aliasDeviceId: string;
  commandRoot: string;
  command: (cmd: string) => string;
  commandTopic: (cmd: string) => string;
};

function getConfig(id: string): AliasDeviceConfig {
  const withoutState = id.replace(/\.[^.]*$/, '');
  const commandRoot = withoutState.replace(/\.(cmnd|tele|stat)\./, '.cmnd.');
  const commandTopic = getObject(id)
    .native.topic.replace(/\/[^/]*$/, '')
    .replace(/\/(cmnd|tele|stat)\//, '/cmnd/');

  return {
    aliasDeviceId: withoutState.replace(/\.(cmnd|tele|stat)\./, '.'),
    commandRoot: commandRoot,
    command: cmd => `${commandRoot}.${cmd}`,
    commandTopic: cmd => `${commandTopic}/${cmd}`,
  };
}

function stateIdToPurpose(stateId: string) {
  switch (stateId.match(/\.shelly25-(\d+)\./)[1]) {
    case '1':
      return 'Living Room Shutters';

    default:
      throw new Error(`No mapping from ${stateId} to purpose`);
  }
}

function getAliasDefinition(): ObjectDefinitionRoot {
  // Shelly 2.5 PM-based shutters.
  return [
    ...$('state[id=mqtt.*.stat.shelly25-*.SHUTTER1]'),
  ].reduce<ObjectDefinitionRoot>((acc, stateId) => {
    const config = getConfig(stateId);

    const deviceStates: {
      [id: string]: iobJS.StateCommon;
    } = {
      device_temperature: {
        alias: {
          id: stateId
            .replace('.stat.', '.tele.')
            .replace('.SHUTTER1', '.SENSOR'),
          read: 'JSON.parse(val).ANALOG.Temperature',
          // No write function makes this read-only.
        },
        role: 'state',
        type: 'number',
        unit: '°C',
        name: 'Temperature of the device',
        read: true,
        write: false,
      },
      level: {
        alias: {
          id: {
            read: stateId,
            write: config.command('ShutterPosition1'),
          },
        },
        role: 'level.blind',
        type: 'number',
        unit: '%',
        min: 0,
        max: 100,
        name: 'Level of Shutters',
        read: true,
        write: true,
        custom: {
          'lovelace.0': {
            enabled: true,
            entity: 'input_number',
            name: Lovelace.id(`${stateIdToPurpose(stateId)} Level`),
          },
        },
      },
      close: {
        alias: {
          id: config.command('ShutterPosition1'),
          read: undefined, // Read-only.
          write: '"CLOSE"',
        },
        role: 'button.close.blind',
        type: 'boolean',
        name: 'Close Shutters Completely',
        read: true,
        write: true,
        def: false,
        custom: {
          'lovelace.0': {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${stateIdToPurpose(stateId)} Close`),
          },
        },
      },
      open: {
        alias: {
          id: config.command('ShutterPosition1'),
          read: undefined, // Read-only.
          write: '"OPEN"',
        },
        role: 'button.open.blind',
        type: 'boolean',
        name: 'Open Shutters Completely',
        read: true,
        write: true,
        def: false,
        custom: {
          'lovelace.0': {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${stateIdToPurpose(stateId)} Open`),
          },
        },
      },
      stop: {
        alias: {
          id: config.command('ShutterPosition1'),
          read: undefined, // Read-only.
          write: '"STOP"',
        },
        role: 'button.stop.blind',
        type: 'boolean',
        name: 'Stop Movement',
        read: true,
        write: true,
        def: false,
        custom: {
          'lovelace.0': {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`${stateIdToPurpose(stateId)} Stop`),
          },
        },
      },
    };

    acc[config.aliasDeviceId] = {
      type: 'device',
      native: {},
      common: { name: stateIdToPurpose(stateId), role: 'blind' },
      enumIds: ObjectCreator.getEnumIds(stateId, 'rooms', 'functions'),
      nested: Object.entries(deviceStates).reduce((acc, [id, common]) => {
        acc[id] = { type: 'state', native: {}, common: common };
        return acc;
      }, {} as ObjectDefinitionRoot),
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

await ObjectCreator.create(getAliasDefinition(), 'alias.0');

await Promise.all(
  [...$('state[id=mqtt.*.stat.shelly25-*.SHUTTER1]')].map(async stateId => {
    const config = getConfig(stateId);

    const commandDefintions: { [id: string]: { type: iobJS.CommonType } } = {
      // Not required, can be achieved with ShutterPosition1.
      // ShutterOpen1: { type: 'string' },
      // ShutterClose1: { type: 'string' },
      // ShutterStop1: { type: 'string' },
      ShutterPosition1: { type: 'string' },
    };

    const commands = Object.entries(commandDefintions).reduce(
      (acc, [command, def]) => {
        acc[command] = {
          type: 'state',
          common: {
            name: config.commandTopic(command),
            write: true,
            read: false,
            role: 'variable',
            desc: 'mqtt client variable',
            type: def.type,
          },
          native: {
            topic: config.commandTopic(command),
          },
        };
        return acc;
      },
      {} as {
        [id: string]: iobJS.PartialStateObject;
      },
    );

    await ObjectCreator.create(
      commands as ObjectDefinitionRoot,
      config.commandRoot,
    );
  }),
);

const position = [...$('state[id=mqtt.*.stat.shelly25-*.SHUTTER1]')]
  .map(stateId => {
    const config = getConfig(stateId);

    // Updated while moving.
    const result = new Stream<string>(
      stateId.replace(/\.SHUTTER1$/, '.RESULT'),
    ).stream.pipe(
      map(x => JSON.parse(x)),
      map(x => x.Shutter1?.Position),
      filter(x => Number.isInteger(x)),
      map(x => x as number),
    );

    // Updated after movement finished.
    const shutter1 = new Stream<number>(stateId).stream;

    return merge(result, shutter1)
      .pipe(
        distinctUntilChanged(),
        tap(level => log(`${config.aliasDeviceId} level ${level}`)),
        tap(level =>
          setState(
            `alias.0.${config.aliasDeviceId}.level`,
            level,
            true,
            err => {
              if (err) {
                log(
                  `Could not set ${config.aliasDeviceId} level to ${level}: ${err}`,
                  'error',
                );
              }
            },
          ),
        ),
      )
      .subscribe();
  })
  .reduce((acc, x) => {
    acc.add(x);
    return acc;
  }, new Subscription());

onStop(() => {
  position.unsubscribe();
});
