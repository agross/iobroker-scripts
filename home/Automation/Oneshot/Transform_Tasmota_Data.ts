import got from 'got';

type DeviceType = 'plug' | 'smart-meter' | 'shutter';

type DeviceInfo = {
  deviceId: string;
  deviceName: string;
  sensorStateId: string;
  lovelace: { icon?: string; name?: string };
};

type DeviceStates = Record<string, iobJS.StateCommon>;

const plugModules = [/^Gosund SP111/, /^NOUS A1T/, /^NOUS B2T/];

function deviceType(module: string): DeviceType | undefined {
  if (plugModules.some(pattern => pattern.test(module))) return 'plug';
  if (module === 'bitShake SmartMeterReader') return 'smart-meter';
  if (module === 'Shelly 2.5 PM') return 'shutter';
}

function entityType(info: DeviceInfo, type: string): string {
  if (type === 'Power') return 'switch';

  return ObjectCreator.getEnumIds(info.sensorStateId, 'functions').includes(
    'enum.functions.light',
  )
    ? 'light'
    : 'sensor';
}

function lovelaceConfig(
  info: DeviceInfo,
  type: string,
  attributes: Record<string, string>,
): {} {
  return {
    entity: entityType(info, type),
    name: Lovelace.id(`${info.deviceName} ${type}`),
    ...attributes,
    ...(info.lovelace.icon == null ? {} : { attr_icon: info.lovelace.icon }),
    ...(info.lovelace.name == null
      ? {}
      : {
          attr_friendly_name:
            type === 'Power'
              ? info.lovelace.name
              : `${info.lovelace.name} ${type}`,
        }),
  };
}

function measurement(
  info: DeviceInfo,
  id: string,
  name: string,
  read: string,
  role: string,
  unit: string,
  attributes: Record<string, string>,
): DeviceStates {
  return {
    [id]: {
      alias: { id: info.sensorStateId, read },
      role,
      type: 'number',
      unit,
      read: true,
      write: false,
      name: `${info.deviceName} ${name}`,
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          ...lovelaceConfig(info, name, attributes),
        },
      },
    },
  };
}

function energyStates(info: DeviceInfo, powerRead: string): DeviceStates {
  return {
    ...measurement(
      info,
      'power',
      'Power Usage',
      powerRead,
      'value.power.consumption',
      'W',
      { attr_device_class: 'power', attr_state_class: 'measurement' },
    ),
    ...measurement(
      info,
      'consumption',
      'Consumption',
      'JSON.parse(val)?.ENERGY?.Total ?? null',
      'value.energy',
      'kWh',
      { attr_device_class: 'energy', attr_state_class: 'total_increasing' },
    ),
  };
}

function plugStates(info: DeviceInfo): DeviceStates {
  const parts = info.sensorStateId.split('.');
  const stateId = (transport: 'cmnd' | 'stat') =>
    parts
      .map((part, index) =>
        index === parts.length - 1
          ? 'POWER'
          : part === 'tele'
            ? transport
            : part,
      )
      .join('.');
  const commandStateId = stateId('cmnd');
  const reportedPowerStateId = stateId('stat');

  return {
    ...energyStates(info, 'JSON.parse(val)?.ENERGY?.Power ?? null'),
    state: {
      alias: {
        id: { read: reportedPowerStateId, write: commandStateId },
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
          ...lovelaceConfig(info, 'Power', { attr_device_class: 'outlet' }),
        },
      },
    },
    'negated-state': {
      alias: {
        id: { read: reportedPowerStateId, write: commandStateId },
        read: 'val !== "ON"',
        write: 'val !== true ? "ON" : "OFF"',
      },
      role: 'indicator.state',
      type: 'boolean',
      read: true,
      write: true,
      name: `${info.deviceName} Power (negated for easier toggling in scenes)`,
    },
  };
}

function smartMeterStates(info: DeviceInfo): DeviceStates {
  const states = {
    ...measurement(
      info,
      'consumption',
      'Consumption',
      'JSON.parse(val)?.Meter?.Consumption ?? null',
      'value.energy',
      'kWh',
      { attr_device_class: 'energy', attr_state_class: 'total_increasing' },
    ),
    ...measurement(
      info,
      'live-consumption',
      'Live Consumption',
      'JSON.parse(val)?.Meter?.["Live Consumption"] ?? null',
      'value.power.consumption',
      'W',
      { attr_device_class: 'power', attr_state_class: 'measurement' },
    ),
    ...measurement(
      info,
      'grid-frequency',
      'Grid Frequency',
      'JSON.parse(val)?.Meter?.["Grid Frequency"] ?? null',
      'value',
      'Hz',
      { attr_device_class: 'frequency' },
    ),
  };

  return [1, 2, 3].reduce((all, phase) => {
    const label = `L${phase}`;
    return {
      ...all,
      ...measurement(
        info,
        `l${phase}-power`,
        `${label} Power`,
        `JSON.parse(val)?.Meter?.["${label} Power"] ?? null`,
        'value.power.consumption',
        'W',
        { attr_device_class: 'power', attr_state_class: 'measurement' },
      ),
      ...measurement(
        info,
        `l${phase}-voltage`,
        `${label} Voltage`,
        `JSON.parse(val)?.Meter?.["${label} Voltage"] ?? null`,
        'value.voltage',
        'V',
        { attr_device_class: 'voltage', attr_state_class: 'measurement' },
      ),
      ...measurement(
        info,
        `l${phase}-current`,
        `${label} Current`,
        `JSON.parse(val)?.Meter?.["${label} Current"] ?? null`,
        'value.current',
        'A',
        { attr_device_class: 'current', attr_state_class: 'measurement' },
      ),
    };
  }, states);
}

async function deviceInfo(sensorStateId: string): Promise<DeviceInfo> {
  const parts = sensorStateId.split('.');
  const transportIndex = parts.indexOf('tele');
  const deviceId = [
    ...parts.slice(0, transportIndex),
    ...parts.slice(transportIndex + 1, -1),
  ].join('.');
  const stateId = [...parts.slice(0, -1), 'STATE'].join('.');
  const tele = JSON.parse(String(getState(stateId).val));
  const status: any = await got
    .get(`http://${tele.IPAddress}/cm`, { searchParams: { cmnd: 'Status' } })
    .json();
  const friendlyNames: { [key: string]: string } = await got
    .get(`http://${tele.IPAddress}/cm`, {
      searchParams: { cmnd: 'FriendlyName' },
    })
    .json();
  const undefinedIfDefault = (name: string) =>
    /^(Tasmota|bitShakeSMR)\d$/.test(name) ? undefined : name;

  return {
    deviceId,
    deviceName:
      undefinedIfDefault(friendlyNames.FriendlyName3) ||
      status.Status.DeviceName,
    sensorStateId,
    lovelace: {
      icon: undefinedIfDefault(friendlyNames.FriendlyName1),
      name: undefinedIfDefault(friendlyNames.FriendlyName2),
    },
  };
}

async function getObjectDefinition(): Promise<ObjectDefinitionRoot> {
  const definitions: ObjectDefinitionRoot = {};

  for (const sensorStateId of [...$('state[id=mqtt.*.tele.*.SENSOR]')]) {
    const infoStateId = `${sensorStateId.slice(0, -'SENSOR'.length)}INFO1`;
    const infoValue = getState(infoStateId)?.val;
    let module: unknown;

    try {
      module = JSON.parse(String(infoValue))?.Info1?.Module;
    } catch {
      module = undefined;
    }
    const type = typeof module === 'string' ? deviceType(module) : undefined;

    if (type == null) {
      log(
        `Ignoring ${sensorStateId}: unsupported module ${String(module)}`,
        'info',
      );
      continue;
    }

    let info: DeviceInfo;
    try {
      info = await deviceInfo(sensorStateId);
    } catch (error) {
      log(
        `Could not determine information from ${sensorStateId}: ${error}`,
        'warn',
      );
      continue;
    }
    const states =
      type === 'plug'
        ? plugStates(info)
        : type === 'shutter'
          ? energyStates(info, 'JSON.parse(val)?.ENERGY?.PowerTotal ?? null')
          : smartMeterStates(info);

    definitions[info.deviceId] = {
      type: 'device',
      native: {},
      common: { name: info.deviceName, role: 'device' },
      enumIds: ObjectCreator.getEnumIds(sensorStateId, 'rooms', 'functions'),
      nested: Object.entries(states).reduce((nested, [id, common]) => {
        nested[id] = { type: 'state', native: {}, common };
        return nested;
      }, {} as ObjectDefinitionRoot),
    };
  }

  return definitions;
}

// https://github.com/ioBroker/ioBroker.javascript/issues/694#issuecomment-721675742
export {};
await ObjectCreator.create(await getObjectDefinition(), 'alias.0');

stopScript(undefined);
