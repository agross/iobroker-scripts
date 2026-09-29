import got from 'got';

type Result<T> = { ok: true; value: T } | { ok: false; error: unknown };

type DeviceInfo = {
  deviceId: string;
  powerStateId: string;
  deviceName: string;
  lovelace: { icon?: string; name?: string };
};

type DeviceStates = { [id: string]: iobJS.StateCommon };

type DeviceConfig = {
  states: string[];
  deviceStates: (info: DeviceInfo, stateId: string) => DeviceStates;
};

function entityType(stateId: string, type: 'Power' | string) {
  if (type === 'Power') {
    return 'switch';
  }

  if (
    ObjectCreator.getEnumIds(stateId, 'functions').includes(
      'enum.functions.light',
    )
  ) {
    return 'light';
  }

  return 'sensor';
}

function lovelaceConfig(
  info: DeviceInfo,
  type: 'Power' | 'Power Usage' | string,
  attributes: Record<string, string> = { attr_device_class: 'outlet' },
): {} {
  const base = {
    entity: entityType(info.powerStateId, type),
    name: Lovelace.id(`${info.deviceName} ${type}`),
    ...attributes,
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

const config: { devices: DeviceConfig[] } = {
  devices: [
    {
      states: [
        ...$('state[id=mqtt.*.cmnd.gosund-sp111-*.POWER]'),
        ...$('state[id=mqtt.*.cmnd.nous-a1t-*.POWER]'),
        ...$('state[id=mqtt.*.cmnd.nous-b2t-*.POWER]'),
      ],
      deviceStates: (info, stateId) => ({
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
          name: `${info.deviceName} Power Usage`,
          custom: {
            [AdapterIds.lovelace]: {
              enabled: true,
              ...lovelaceConfig(info, 'Power Usage', {
                attr_device_class: 'power',
                attr_state_class: 'measurement',
              }),
            },
          },
        },
        'negated-state': {
          alias: {
            id: {
              read: stateId.replace('.cmnd.', '.stat.'),
              write: stateId,
            },
            read: 'val !== "ON"',
            write: 'val !== true ? "ON" : "OFF"',
          },
          role: 'indicator.state',
          type: 'boolean',
          read: true,
          write: true,
          name: `${info.deviceName} Power (negated for easier toggling in scenes)`,
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
          name: `${info.deviceName} Power`,
          custom: {
            [AdapterIds.lovelace]: {
              enabled: true,
              ...lovelaceConfig(info, 'Power'),
            },
          },
        },
      }),
    },
    {
      states: [...$('state[id=mqtt.*.tele.smart-meter-reader.STATE]')],
      // Smart meters expose several measurements from their MQTT JSON payload.
      // Add their aliases here; they do not have the plug state aliases above.
      deviceStates: (info, stateId) => ({
        consumption: {
          alias: {
            id: stateId.replace(/\.STATE$/, '.SENSOR'),
            read: 'JSON.parse(val)?.Meter.Consumption ?? null',
            // No write function makes this read-only.
          },
          role: 'value.energy',
          type: 'number',
          unit: 'kWh',
          read: true,
          write: false,
          name: `${info.deviceName} Consumption`,
          custom: {
            [AdapterIds.lovelace]: {
              enabled: true,
              ...lovelaceConfig(info, 'Consumption', {
                attr_device_class: 'energy',
                attr_state_class: 'total_increasing',
              }),
            },
          },
        },
        'live-consumption': {
          alias: {
            id: stateId.replace(/\.STATE$/, '.SENSOR'),
            read: 'JSON.parse(val)?.Meter["Live Consumption"] ?? null',
            // No write function makes this read-only.
          },
          role: 'value.power.consumption',
          type: 'number',
          unit: 'W',
          read: true,
          write: false,
          name: `${info.deviceName} Live Consumption`,
          custom: {
            [AdapterIds.lovelace]: {
              enabled: true,
              ...lovelaceConfig(info, 'Live Consumption', {
                attr_device_class: 'power',
                attr_state_class: 'measurement',
              }),
            },
          },
        },
        'grid-frequency': {
          alias: {
            id: stateId.replace(/\.STATE$/, '.SENSOR'),
            read: 'JSON.parse(val)?.Meter["Grid Frequency"] ?? null',
            // No write function makes this read-only.
          },
          role: 'value',
          type: 'number',
          unit: 'Hz',
          read: true,
          write: false,
          name: `${info.deviceName} Grid Frequency`,
          custom: {
            [AdapterIds.lovelace]: {
              enabled: true,
              ...lovelaceConfig(info, 'Grid Frequency', {
                attr_device_class: 'frequency',
              }),
            },
          },
        },
        ...Object.assign(
          {},
          ...[1, 2, 3].map(phase => {
            const label = `L${phase}`;
            const sensorStateId = stateId.replace(/\.STATE$/, '.SENSOR');

            return {
              [`l${phase}-power`]: {
                alias: {
                  id: sensorStateId,
                  read: `JSON.parse(val)?.Meter["${label} Power"] ?? null`,
                  // No write function makes this read-only.
                },
                role: 'value.power.consumption',
                type: 'number',
                unit: 'W',
                read: true,
                write: false,
                name: `${info.deviceName} ${label} Power`,
                custom: {
                  [AdapterIds.lovelace]: {
                    enabled: true,
                    ...lovelaceConfig(info, `${label} Power`, {
                      attr_device_class: 'power',
                      attr_state_class: 'measurement',
                    }),
                  },
                },
              },
              [`l${phase}-voltage`]: {
                alias: {
                  id: sensorStateId,
                  read: `JSON.parse(val)?.Meter["${label} Voltage"] ?? null`,
                  // No write function makes this read-only.
                },
                role: 'value.voltage',
                type: 'number',
                unit: 'V',
                read: true,
                write: false,
                name: `${info.deviceName} ${label} Voltage`,
                custom: {
                  [AdapterIds.lovelace]: {
                    enabled: true,
                    ...lovelaceConfig(info, `${label} Voltage`, {
                      attr_device_class: 'voltage',
                      attr_state_class: 'measurement',
                    }),
                  },
                },
              },
              [`l${phase}-current`]: {
                alias: {
                  id: sensorStateId,
                  read: `JSON.parse(val)?.Meter["${label} Current"] ?? null`,
                  // No write function makes this read-only.
                },
                role: 'value.current',
                type: 'number',
                unit: 'A',
                read: true,
                write: false,
                name: `${info.deviceName} ${label} Current`,
                custom: {
                  [AdapterIds.lovelace]: {
                    enabled: true,
                    ...lovelaceConfig(info, `${label} Current`, {
                      attr_device_class: 'current',
                      attr_state_class: 'measurement',
                    }),
                  },
                },
              },
            };
          }),
        ),
      }),
    },
  ],
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

  const friendlyNames: { [key: string]: string } = await got
    .get(`http://${tele.IPAddress}/cm`, {
      searchParams: { cmnd: 'FriendlyName' },
    })
    .json();

  const deviceName = status.Status.DeviceName;

  function undefinedIfDefault(str: string) {
    if (str.match(/^(Tasmota|bitShakeSMR)\d$/)) {
      return undefined;
    }

    return str;
  }
  const icon = undefinedIfDefault(friendlyNames.FriendlyName1);
  const name = undefinedIfDefault(friendlyNames.FriendlyName2);
  const customDeviceName = undefinedIfDefault(friendlyNames.FriendlyName3);

  return {
    deviceId: stateId
      .replace(/\.[^.]*$/, '')
      .replace(/\.(cmnd|tele|stat)\./, '.'),
    powerStateId: stateId,
    deviceName: customDeviceName || deviceName,
    lovelace: { icon, name },
  };
}

const deviceInfos = await Promise.all(
  config.devices.flatMap(device =>
    device.states.map(async state => ({
      state,
      config: device,
      info: await toResult(deviceInfo(state)),
    })),
  ),
);

function getObjectDefinition(): ObjectDefinitionRoot {
  return deviceInfos.reduce((acc, device) => {
    const stateId = device.state;
    const info = device.info;

    if (!info.ok) {
      log(
        `Could not determine information from ${device.state}, skipping: ${(info as any).error}`,
        'warn',
      );
      return acc;
    }

    const deviceStates = device.config.deviceStates(info.value, stateId);

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
