import got from 'got';
import * as util from 'node:util';

const config = {
  dryRun: false,
};

async function check(stateId: string, expected: Partial<iobJS.StateCommon>) {
  const state = await getObjectAsync(stateId);
  const commonShrunkDownToExpected = Utils.shrink(state!.common, expected);

  if (
    commonShrunkDownToExpected &&
    util.isDeepStrictEqual(
      JSON.parse(JSON.stringify(expected)),
      JSON.parse(JSON.stringify(commonShrunkDownToExpected)),
    )
  ) {
    return;
  }

  log(
    `${stateId}: expected ${JSON.stringify(
      expected,
      null,
      2,
    )} but got ${JSON.stringify(commonShrunkDownToExpected, null, 2)}`,
    'warn',
  );

  if (config.dryRun) {
    return;
  }

  await extendObjectAsync(stateId, {
    common: expected,
  });
}

gradientCapableZigbeeLights();
zigbeeIcons();
zigbeeDoorContacts();
zigbeeMotionSensors();
zigbeeTemperatureHumidityAndPressureSensors();
zigbeeSmokeDetectors();
zigbeeValves();

scenes();

homeMaticThermostats();
homeMaticPresenceDetectors();

scripts();

pingedMachines();

kodi();

androidDebugBridge();

maxDayTemperature();

ecovacsDeebot();

fuelPrices();

synology();

function gradientCapableZigbeeLights() {
  $('state[id=zigbee.*.gradient_scene]').each(async id => {
    const name = Device.deviceName(id);

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'input_select',
          name: Lovelace.id(name),
          attr_friendly_name: `${name} Gradient Scene`,
        },
      },
    };

    await check(id, expect);
  });
}

function zigbeeIcons() {
  [...$('state[id=zigbee.*.available]')]
    .map(id => id.replace(/\.available$/, ''))
    .forEach(async deviceId => {
      const device = await getObjectAsync(deviceId);

      if (device?.common.icon !== 'img/unknown.png') {
        return;
      }

      const iconUrl = `https://www.zigbee2mqtt.io/images/devices/${device.common.type}.jpg`;

      try {
        const response = Buffer.from(await got(iconUrl).buffer());
        const iconAsBase64 = response.toString('base64');

        const expect: Partial<iobJS.StateCommon> = {
          icon: `data:image/jpeg;base64,${iconAsBase64}`,
        };

        await check(deviceId, expect);
      } catch (error) {
        log(`Error downloading ${iconUrl}: ${error}`, 'error');
      }
    });
}

function zigbeeDoorContacts() {
  $('state[id=zigbee.*.opened]').each(async id => {
    const name = Device.deviceName(id);

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'binary_sensor',
          name: Lovelace.id(name),
          attr_device_class: 'opening',
          attr_friendly_name: name.replace(/\s+Contact$/, ''),
        },
      },
    };

    await check(id, expect);
  });
}

function zigbeeMotionSensors() {
  $('state[id=zigbee.*.illuminance]').each(async id => {
    const rawIlluminance = `${id}_raw`;
    if (existsState(rawIlluminance)) {
      id = rawIlluminance;
    }

    const name = Device.deviceName(id);

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'sensor',
          name: Lovelace.id(`${name} Illuminance`),
          attr_device_class: 'illuminance',
          attr_unit_of_measurement: 'lux',
          attr_friendly_name: name.replace('Motion Sensor', 'Illuminance'),
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=zigbee.*.occupancy]').each(async id => {
    const name = Device.deviceName(id);

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'binary_sensor',
          name: Lovelace.id(`${name} Occupancy`),
          attr_device_class: 'motion',
          attr_friendly_name: name.replace('Motion Sensor', 'Occupancy'),
        },
      },
    };

    await check(id, expect);
  });
}

function zigbeeTemperatureHumidityAndPressureSensors() {
  $('state[id=zigbee.*.humidity]').each(async id => {
    const name = Device.deviceName(id);

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'sensor',
          name: Lovelace.id(`${name} Humidity`),
          attr_device_class: 'humidity',
          attr_unit_of_measurement: '%',
          attr_friendly_name: `${name.replace(/\sSensor/, '')} Humidity`,
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=zigbee.*.soil_moisture]').each(async id => {
    const name = Device.deviceName(id);

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'sensor',
          name: Lovelace.id(`${name} Soil Moisture`),
          attr_device_class: 'humidity',
          attr_unit_of_measurement: '%',
          attr_friendly_name: `${name.replace(/\sSensor/, '')} Soil Moisture`,
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=zigbee.*.temperature]').each(async id => {
    const device = Device.id(id);
    if (device && (await getObjectAsync(device))!.common.type === 'RTCGQ11LM') {
      // Aqara Motion Sensor does not report temperature despite
      // iobroker.zigbee thinking it does.
      return;
    }

    const name = Device.deviceName(id);

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'sensor',
          name: Lovelace.id(`${name} Temperature`),
          attr_device_class: 'temperature',
          attr_unit_of_measurement: '°C',
          attr_friendly_name: name.replace(/(Motion\s)?Sensor/, 'Temperature'),
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=zigbee.*.pressure]').each(async id => {
    const name = Device.deviceName(id);

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'sensor',
          name: Lovelace.id(`${name} Pressure`),
          attr_device_class: 'pressure',
          attr_unit_of_measurement: 'hPa',
          attr_friendly_name: name.replace('Sensor', 'Pressure'),
        },
      },
    };

    await check(id, expect);
  });
}

function zigbeeSmokeDetectors() {
  $('state[id=zigbee.*.smoke]').each(async id => {
    const name = Device.deviceName(id);

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'binary_sensor',
          name: Lovelace.id(`${name} Smoke Detected`),
          attr_device_class: 'smoke',
          attr_friendly_name: name.replace('Detector', 'Detected'),
        },
      },
    };

    await check(id, expect);
  });
}

function zigbeeValves() {
  const devices = [
    ...$('state[id=zigbee.*.auto_close_when_water_shortage]'),
  ].map(x => ({
    id: Device.id(x),
    name: Device.deviceName(x),
  }));

  devices.forEach(async device => {
    const id = `${device.id}.state`;

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'switch',
          name: Lovelace.id(`${device.name} Valve Open`),
          attr_device_class: 'outlet',
          attr_friendly_name: `${device.name} Valve Open`,
          attr_icon: 'mdi:water',
        },
      },
    };

    await check(id, expect);
  });
}

function scenes() {
  $('state[id=scene.*][role=scene.state]').each(async id => {
    const name = id.replace(/^scene\.\d+\./, '').replace(/[._]/g, ' ');
    const friendlyName = id
      .substring(id.lastIndexOf('.') + 1)
      .replace(/[._]/g, ' ')
      .replace(/^(Lights\s)((?!Off))/, (_match, _lightsPrefix, scene) => {
        return scene;
      });

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'scene',
          name: Lovelace.id(name),
          attr_friendly_name: friendlyName,
        },
      },
    };

    await check(id, expect);
  });
}

async function checkThermostatAlias(id: string, common: iobJS.StateCommon) {
  if (existsObject(id)) {
    await check(id, common);
  } else if (config.dryRun) {
    log(`Would create thermostat alias ${id}`, 'info');
  } else {
    await setObjectAsync(id, { type: 'state', common, native: {} });
  }
}

async function thermostatModeAlias(
  deviceId: string,
  name: string,
  setpointId: string,
): Promise<string | null> {
  const controlId = `${deviceId}.1.CONTROL_MODE`;
  if (!existsState(controlId)) {
    return null;
  }

  const aliasId = `alias.0.${deviceId}.mode`;
  const aliasObject = await getObjectAsync(aliasId);
  const alias = aliasObject?.type === 'state' ? aliasObject : undefined;
  if (aliasObject && !alias) {
    throw new Error(`Expected a mode state at ${aliasId}`);
  }
  const common: iobJS.StateCommon = {
    ...alias?.common,
    name: `${name} mode`,
    type: 'mixed',
    role: 'level.mode.thermostat',
    read: true,
    write: true,
    states: { 0: 'auto' },
    alias: {
      id: { read: setpointId, write: controlId },
      read: 'val == null ? null : (val === 4.5 ? "off" : 0)',
      write: '0',
    },
  };
  // Off is a readback from the target temperature. Auto is the only mode command.
  if (!config.dryRun && !util.isDeepStrictEqual(alias?.common, common)) {
    await setObjectAsync(aliasId, {
      ...alias,
      type: 'state',
      common,
      native: alias?.native ?? {},
    });
  }
  return aliasId;
}

function homeMaticThermostats() {
  $('state[id=hm-rpc.1.*.1.SET_POINT_TEMPERATURE]').each(async id => {
    const channelId = id.replace(/\.SET_POINT_TEMPERATURE$/, '');
    const deviceId = channelId.replace(/\.1$/, '');
    const profileId = `${channelId}.ACTIVE_PROFILE`;
    const valveStateId = `${deviceId}.10.STATE`;
    const binaryValve = existsState(valveStateId);
    const valveId = binaryValve ? valveStateId : `${channelId}.LEVEL`;
    const attributes = [
      {
        attribute: 'active_profile',
        state: profileId,
        format: 'val == null ? null : "Profile " + val',
      },
      {
        attribute: 'valve_open',
        state: valveId,
        format: binaryValve
          ? 'val == null ? null : (val ? "Valve open" : "Valve closed")'
          : 'val == null ? null : "Valve " + Math.round(val * 100) + "%"',
      },
    ].filter(({ state }) => existsState(state));

    if (attributes.length === 0) {
      return;
    }

    const aliasDeviceId = `alias.0.${deviceId}`;
    const common = { name: getObject(deviceId).common.name };
    const name = Device.english(common.name);
    if (existsObject(aliasDeviceId)) {
      await check(aliasDeviceId, common);
    } else if (config.dryRun) {
      log(`Would create thermostat alias device ${aliasDeviceId}`, 'info');
    } else {
      await setObjectAsync(aliasDeviceId, {
        type: 'device',
        common,
        native: {},
      });
    }

    const labels = await Promise.all(
      attributes.map(async ({ attribute, state, format }) => {
        const label = `${attribute}_label`;
        const aliasId = `${aliasDeviceId}.${label}`;
        await checkThermostatAlias(aliasId, {
          name: `${name} ${label.replace(/_/g, ' ')}`,
          type: 'string',
          role: 'text',
          read: true,
          write: false,
          alias: { id: state, read: format },
        });

        return { attribute: label, state: aliasId };
      }),
    );

    const modeId = await thermostatModeAlias(deviceId, name, id);

    const climateStates = Object.fromEntries(
      Object.entries({
        state_ACTUAL: `${channelId}.ACTUAL_TEMPERATURE`,
        state_HUMIDITY: `${channelId}.HUMIDITY`,
        state_BOOST: `${channelId}.BOOST_MODE`,
      }).filter(([, state]) => existsState(state)),
    );

    // Lovelace stores manual climate settings on the setpoint state.
    await check(id, {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'climate',
          name: Lovelace.id(name),
          attr_friendly_name: name,
          attr_icon: 'mdi:radiator',
          attr_target_temp_step: 0.5,
          state_SET: id,
          state_MODE: modeId,
          ...climateStates,
          customAttributes: [
            ...attributes.map(({ attribute, state }) => ({ attribute, state })),
            ...labels,
          ],
        },
      },
    });
  });
}

function homeMaticPresenceDetectors() {
  $('state[id=hm-rpc.*.1.ILLUMINATION]').each(async id => {
    const name = `${Device.deviceName(id)} Illumination`;

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'sensor',
          name: Lovelace.id(name),
          attr_device_class: 'illuminance',
          attr_unit_of_measurement: 'lm',
          attr_friendly_name: name,
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=hm-rpc.*.1.PRESENCE_DETECTION_STATE]').each(async id => {
    const name = `${Device.deviceName(id)} Presence`;

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'binary_sensor',
          name: Lovelace.id(name),
          attr_device_class: 'motion',
          attr_friendly_name: name,
        },
      },
    };

    await check(id, expect);
  });
}

function scripts() {
  $(
    'state[id=javascript.*.scriptEnabled.Automation.*][role=switch.active]',
  ).each(async id => {
    const name = id.replace(/^javascript\.\d+\.scriptEnabled\./, '');
    const lovelaceId = name.replace(/[._]/g, ' ');
    const friendlyName = name.replace(/.*\.(\w+)$/, '$1').replace(/[._]/g, ' ');

    const config = {
      enabled: true,
      entity: 'automation',
      name: Lovelace.id(lovelaceId),
      attr_friendly_name: friendlyName,
    } as Record<string, any>;

    if (name === 'Automation.TV_Idle') {
      config.attr_icon = 'mdi:clock-time-three-outline';
    }

    if (name === 'Automation.Washing_Machine') {
      config.attr_icon = 'mdi:washing-machine-alert';
    }

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: config,
      },
    };

    await check(id, expect);
  });
}

function pingedMachines() {
  $('state[id=ping.*.iobroker.*][role=indicator.reachable]').each(async id => {
    const aliveMachine = Utils.english((await getObjectAsync(id))!.common.name);
    const machine = aliveMachine.replace(/^Alive\s+/, '');
    const name = `Ping ${machine}`;

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'binary_sensor',
          name: Lovelace.id(name),
          attr_friendly_name: name,
          attr_device_class: 'power',
        },
      },
    };

    await check(id, expect);
  });
}

function kodi() {
  $('state[id=kodi.*.info.connection]').each(async id => {
    const name = 'Kodi Connected';

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'binary_sensor',
          name: Lovelace.id(name),
          attr_friendly_name: name,
          attr_device_class: 'connectivity',
        },
      },
    };

    await check(id, expect);
  });
}

function androidDebugBridge() {
  $('state[id=adb.*.*.connection]').each(async id => {
    if ((await getObjectAsync(id.replace(/\.[^.]*$/, '')))?.type !== 'device') {
      return;
    }

    const name = 'ADB Connected';

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'binary_sensor',
          name: Lovelace.id(name),
          attr_friendly_name: name,
          attr_device_class: 'connectivity',
        },
      },
    };

    await check(id, expect);
  });
}

function maxDayTemperature() {
  $('state[id=pirate-weather.*.weather.daily.00.temperatureMax]').each(
    async id => {
      const expect: Partial<iobJS.StateCommon> = {
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'sensor',
            name: Lovelace.id('Weather Max Temp Today'),
            attr_friendly_name: 'Highest Day Temperature',
            attr_icon: 'mdi:thermometer-chevron-up',
          },
        },
      };

      await check(id, expect);
    },
  );
}

function ecovacsDeebot() {
  const deebots = $('state[id=ecovacs-deebot.*.status.device]');
  deebots.each(async id => {
    const device = id.replace(/\.status\.device$/, '');

    const name = getState(`${device}.info.deviceName`).val;

    // Map loading is broken.
    // https://github.com/mrbungle64/ioBroker.ecovacs-deebot/issues/858
    try {
      const currentMapId = getState(`${device}.map.currentMapMID`).val;
      setState(`${device}.map.${currentMapId}.loadMapImage`, true, err => {
        if (err) {
          log(
            `Could not load map image for ${device}, needs activation in device adapter settings: ${err}`,
            'error',
          );
        }
      });
    } catch (err) {
      log(`Could not load map image for ${device}: ${err}`, 'warn');
    }

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'vacuum',
          name: Lovelace.id(name),
          attr_friendly_name: name,
          state_STATE: `${device}.info.deviceStatus`,
          state_POWER: `${device}.control.clean`,
          state_PAUSE: `${device}.control.pause`,
          state_BATTERY: `${device}.info.battery`,
          state_WORK_MODE: `${device}.control.cleanSpeed`,
          // Prefer device image.
          state_MAP: `${device}.info.deviceImageURL`,
        },
      },
    };

    const currentMapId = getState(`${device}.map.currentMapMID`).val;
    const rooms = $(
      `state[id=${device}.map.${currentMapId}.spotAreas.*.spotAreaID]`,
    );
    rooms.each(async idState => {
      const areaId = (getState(idState).val ?? '').toString();
      const nameState = idState.replace(/\.spotAreaID$/, '.spotAreaName');
      const area = getState(nameState).val as string;
      const id = `${device}.control.spotArea_${areaId}`;
      if (!areaId || !existsState(id)) {
        return;
      }

      if (typeof area !== 'string' || area.length <= 1) {
        log(
          `Spot area ${id} named ${area} has not been configured by the user`,
          'warn',
        );
        return;
      }

      const expect: Partial<iobJS.StateCommon> = {
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id(`Clean ${area}`),
            attr_device_class: 'switch',
            attr_icon: 'mdi:broom',
            attr_friendly_name: `Clean ${area}`,
          },
        },
      };

      await check(id, expect);
    });

    await check(id, expect);
  });

  $('state[id=ecovacs-deebot.*.control.clean]').each(async id => {
    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'switch',
          name: Lovelace.id('Clean All Rooms'),
          attr_device_class: 'switch',
          attr_icon: 'mdi:broom',
          attr_friendly_name: 'Clean All Rooms',
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=ecovacs-deebot.*.control.charge]').each(async id => {
    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'switch',
          name: Lovelace.id('Return To Charge'),
          attr_device_class: 'switch',
          attr_icon: 'mdi:ev-station',
          attr_friendly_name: 'Return To Charge',
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=ecovacs-deebot.*.control.pause]').each(async id => {
    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'switch',
          name: Lovelace.id(`Pause Cleaning`),
          attr_device_class: 'switch',
          attr_icon: 'mdi:pause',
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=ecovacs-deebot.*.control.resume]').each(async id => {
    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'switch',
          name: Lovelace.id(`Resume Cleaning`),
          attr_device_class: 'switch',
          attr_icon: 'mdi:play-pause',
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=ecovacs-deebot.*.control.stop]').each(async id => {
    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'switch',
          name: Lovelace.id(`Stop Cleaning`),
          attr_device_class: 'switch',
          attr_icon: 'mdi:stop',
        },
      },
    };

    await check(id, expect);
  });
}

function fuelPrices() {
  $('state[id=tankerkoenig.*.stations.*.diesel.short]').each(id => {
    if (id.includes('.cheapest.')) {
      return;
    }

    const stationNameId = id.split('.').slice(0, -2).concat(['name']).join('.');

    if (!existsState(stationNameId)) {
      return;
    }

    const stationName = getState(stationNameId).val;
    const name = `Diesel Price ${stationName}`;

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'sensor',
          name: Lovelace.id(name),
          attr_friendly_name: stationName,
          attr_unit_of_measurement: '€',
          attr_icon: 'mdi:currency-eur',
        },
      },
    };

    check(id, expect);
  });
}

function synology() {
  $('state[id=synology.*.commands.*][role=button]').each(id => {
    let hostname = 'NAS';
    const hostnameState = `${id.split('.').slice(0, 2).join('.')}.FileStation.info.hostname`;
    if (existsState(hostnameState)) {
      hostname = getState(hostnameState).val;
    }

    const command = id.split('.').slice(-1)[0];
    const commandTitleCase = `${command[0].toUpperCase()}${command.substring(1)}`;
    const name = `${commandTitleCase} Synology ${hostname}`;

    var icon = '';
    switch (command) {
      case 'shutdown':
        icon = 'stop';
        break;
      case 'reboot':
        icon = 'restart';
        break;
      case 'wake':
        icon = 'play-network';
        break;
    }

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'scene',
          name: Lovelace.id(name),
          attr_friendly_name: commandTitleCase,
          attr_icon: `mdi:${icon}`,
        },
      },
    };

    check(id, expect);
  });
}

stopScript(undefined);
