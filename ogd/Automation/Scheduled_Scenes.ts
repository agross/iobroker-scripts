import util from 'util';
import { tap } from 'rxjs/operators';

const config = {
  override: ['0_userdata.0', 'Scheduled Scenes'],
  disabledTriggers: {
    onTrue: { trigger: {}, cron: null, astro: null },
    onFalse: {
      enabled: false,
      trigger: {},
      cron: null,
      astro: null,
    },
  },
};

function scenesWithTriggers() {
  return [...$('state[id=scene.*][role=scene.state]')].filter(id => {
    const object = getObject(id);

    const hasTrigger =
      object.native.onTrue.trigger.id ||
      object.native.onTrue.cron ||
      object.native.onFalse.trigger.id ||
      object.native.onFalse.cron;

    const hasSavedTrigger = object.common?.custom?.sceneTrigger;

    return hasTrigger || hasSavedTrigger;
  });
}

function getObjectDefinition(scenes: string[]): ObjectDefinitionRoot {
  const template = (name: string) =>
    ({
      type: 'state',
      common: {
        name: name,
        type: 'boolean',
        def: true,
        read: true,
        write: true,
        role: 'state',
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'input_boolean',
            name: Lovelace.id(name),
            attr_friendly_name: name,
          },
        },
      } as iobJS.StateCommon,
      native: {},
    }) as ObjectDefinition;

  const overrides = scenes.reduce(
    (acc: { [key: string]: ObjectDefinition }, id) => {
      const object = getObject(id);
      acc[id] = template(`Schedule enabled for ${object.common.name}`);
      return acc;
    },
    {},
  );

  return {
    [config.override[1]]: {
      type: 'channel',
      common: { name: config.override[1] },
      native: {},
      nested: overrides,
    },
  } as ObjectDefinitionRoot;
}

const scenes = scenesWithTriggers();

scenes.forEach(async id => {
  const object = await getObjectAsync(id);
  if (!object) {
    return;
  }

  object.common.custom ??= {};
  object.common.custom.sceneTrigger ??= {};

  if (
    !util.isDeepStrictEqual(
      JSON.parse(JSON.stringify(config.disabledTriggers.onTrue)),
      JSON.parse(JSON.stringify(object.native.onTrue)),
    )
  ) {
    object.common.custom.sceneTrigger.onTrue = object.native.onTrue;
  }
  if (
    !util.isDeepStrictEqual(
      JSON.parse(JSON.stringify(config.disabledTriggers.onFalse)),
      JSON.parse(JSON.stringify(object.native.onFalse)),
    )
  ) {
    object.common.custom.sceneTrigger.onFalse = object.native.onFalse;
  }

  log(
    `Saving default triggers of ${id}: ${JSON.stringify(object.common.custom.sceneTrigger, null, 2)}`,
  );

  await setObjectAsync(id, object as any);
});

const objects = getObjectDefinition(scenes);
await ObjectCreator.create(objects, config.override[0]);

const subscriptions = [
  ...$(`state[id=${config.override.join('.')}.*][role=state]`),
]
  .map(id => [id.slice(config.override.join('.').length + 1), id])
  .map(([scene, user]) => {
    log(scene);
    log(user);
    return new Stream<boolean>({ id: user, ack: false }).stream
      .pipe(
        tap(async state => {
          const object = await getObjectAsync(scene);
          if (!object || !object.common.custom) {
            return;
          }

          if (state === true) {
            log(`Enabling triggers: ${scene}`);

            object.native.onTrue = object.common.custom.sceneTrigger.onTrue;
            object.native.onFalse = object.common.custom.sceneTrigger.onFalse;
          } else {
            log(`Disabling triggers: ${scene}`);

            object.native.onTrue = config.disabledTriggers.onTrue;
            object.native.onFalse = config.disabledTriggers.onFalse;
          }

          await setObjectAsync(scene, object as any);
          await setStateAsync(user, state, true);
        }),
      )
      .subscribe();
  });

onStop(() => subscriptions.forEach(x => x.unsubscribe()));
