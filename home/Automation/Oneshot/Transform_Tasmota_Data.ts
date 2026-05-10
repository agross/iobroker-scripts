import got from 'got';

const config = {
  devices: [
    ...$('state[id=mqtt.*.cmnd.gosund-sp111-*.POWER]'),
    ...$('state[id=mqtt.*.cmnd.nous-a1t-*.POWER]'),
    ...$('state[id=mqtt.*.cmnd.nous-b2t-*.POWER]'),
  ],
};

type Result<T> = { ok: true; value: T } | { ok: false; error: unknown };

type DeviceInfo = {
  deviceId: string;
  powerStateId: string;
  deviceName: string;
  lovelace: { icon?: string; name?: string };
};

async function toResult<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

async function deviceInfo(stateId: string): Promise<DeviceInfo> {
  const teleState = stateId
    .replace('.cmnd.', '.tele.')
    .replace(/\.POWER$/, '.STATE');
  const tele = JSON.parse(getState(teleState).val);

  const status: any = await got
    .get(`http://${tele.IPAddress}/cm`, {
      searchParams: { cmnd: 'Status' },
    })
    .json();

  const deviceName = status.Status.DeviceName;
  const friendlyName: string = status.Status.FriendlyName[0];
  const [icon, name] =
    friendlyName === '' ? [undefined, undefined] : friendlyName.split('|', 2);

  return {
    deviceId: stateId
      .replace(/\.[^.]*$/, '')
      .replace(/\.(cmnd|tele|stat)\./, '.'),
    powerStateId: stateId,
    deviceName: deviceName,
    lovelace: { icon, name },
  };
}

const deviceInfos = await Promise.all(
  config.devices.map(async dev => ({
    state: dev,
    info: await toResult(deviceInfo(dev)),
  })),
);

function getObjectDefinition(): ObjectDefinitionRoot {
  function entityType(stateId: string, type: 'Power' | 'Power Usage') {
    if (type == 'Power Usage') {
      return 'sensor';
    }

    if (
      ObjectCreator.getEnumIds(stateId, 'functions').includes(
        'enum.functions.light',
      )
    ) {
      return 'light';
    }

    return 'switch';
  }

  function lovelaceConfig(info: DeviceInfo, type: 'Power' | 'Power Usage'): {} {
    const base = {
      entity: entityType(info.powerStateId, type),
      name: Lovelace.id(`${info.deviceName} ${type}`),
      attr_device_class: 'outlet',
    };

    const icon = {
      attr_icon: info.lovelace.icon,
    };

    const name = {
      attr_friendly_name:
        type === 'Power' ? info.lovelace.name : `${info.lovelace.name} ${type}`,
    };

    return {
      ...base,
      ...(info.lovelace.icon != null ? icon : {}),
      ...(info.lovelace.name != null ? name : {}),
    };
  }

  return deviceInfos.reduce((acc, deviceInfo) => {
    const stateId = deviceInfo.state;
    const info = deviceInfo.info;

    if (!info.ok) {
      log(
        `Could not determine information from ${deviceInfo.state}, skipping: ${(info as any).error}`,
        'warn',
      );
      return acc;
    }

    const deviceStates: {
      [id: string]: iobJS.StateCommon;
    } = {
      power: {
        alias: {
          id: stateId
            .replace('.cmnd.', '.tele.')
            .replace(/\.POWER$/, '.SENSOR'),
          read: 'JSON.parse(val)?.ENERGY?.Power ?? null',
          // No write function makes this read-only.
        },
        role: 'value',
        type: 'number',
        unit: 'W',
        read: true,
        write: false,
        name: `${info.value.deviceName} Power Usage`,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            ...lovelaceConfig(info.value, 'Power Usage'),
          },
        },
      },
      'negated-state': {
        alias: {
          id: {
            read: deviceInfo.state.replace('.cmnd.', '.stat.'),
            write: deviceInfo.state,
          },
          read: 'val !== "ON"',
          write: 'val !== true ? "ON" : "OFF"',
        },
        role: 'indicator.state',
        type: 'boolean',
        read: true,
        write: true,
        name: `${info.value.deviceName} Power (negated for easier toggling in scenes)`,
      },
      state: {
        alias: {
          id: { read: stateId.replace('.cmnd.', '.stat.'), write: stateId },
          read: 'val === "ON"',
          write: 'val === true ? "ON" : "OFF"',
        },
        role: 'switch',
        type: 'boolean',
        read: true,
        write: true,
        name: `${info.value.deviceName} Power`,
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            ...lovelaceConfig(info.value, 'Power'),
          },
        },
      },
    };

    acc[info.value.deviceId] = {
      type: 'device',
      native: {},
      common: { name: info.value.deviceName, role: 'device' },
      enumIds: ObjectCreator.getEnumIds(stateId, 'rooms', 'functions'),
      nested: Object.entries(deviceStates).reduce((acc, [id, common]) => {
        acc[id] = { type: 'state', native: {}, common: common };
        return acc;
      }, {} as ObjectDefinitionRoot),
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

// https://github.com/ioBroker/ioBroker.javascript/issues/694#issuecomment-721675742
export {};
await ObjectCreator.create(getObjectDefinition(), 'alias.0');

stopScript(undefined);
