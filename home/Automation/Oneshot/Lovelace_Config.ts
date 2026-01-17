import got from 'got';
import util from 'util';

const config = {
  dryRun: false,
};

async function check(stateId: string, expected: Partial<iobJS.StateCommon>) {
  const state = await getObjectAsync(stateId);
  const commonShrunkDownToExpected = Utils.shrink(state.common, expected);

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

homeMaticVariables();

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

      if (device.common.icon && device.common.icon !== 'img/unknown.png') {
        return;
      }

      const iconUrl = `https://www.zigbee2mqtt.io/images/devices/${device.common.type}.jpg`;

      try {
        const response = await got(iconUrl).buffer();
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
    if (device && (await getObjectAsync(device)).common.type === 'RTCGQ11LM') {
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
  const devices = [...$('state[id=zigbee.*.irrigation_interval]')].map(x => ({
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

function homeMaticThermostats() {
  $('state[id=hm-rpc.1.*.1.ACTIVE_PROFILE]').each(async id => {
    const name = `${Device.deviceName(id)} Active Profile`;

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'input_number',
          name: Lovelace.id(name),
          attr_mode: 'slider',
          attr_friendly_name: 'Profile',
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=hm-rpc.1.*.1.HUMIDITY]').each(async id => {
    const name = `${Device.deviceName(id)} Humidity`;

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'sensor',
          name: Lovelace.id(name),
          attr_device_class: 'humidity',
          attr_unit_of_measurement: '%',
          attr_friendly_name: 'Humidity',
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=hm-rpc.1.*.10.STATE]').each(async id => {
    const name = `${Device.deviceName(id)} Valve Open`;

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'binary_sensor',
          name: Lovelace.id(name),
          attr_device_class: 'heat',
          attr_friendly_name: 'Valve Open',
        },
      },
    };

    await check(id, expect);
  });

  $('state[id=hm-rpc.1.*.1.LEVEL]').each(async id => {
    const name = `${Device.deviceName(id)} Valve Open`;

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'sensor',
          name: Lovelace.id(name),
          attr_device_class: 'energy',
          attr_unit_of_measurement: '%',
          attr_friendly_name: 'Valve Open',
        },
      },
    };

    await check(id, expect);
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

function homeMaticVariables() {
  $('state[id=hm-rega.*][role=state]{TypeName=VARDP}').each(async id => {
    let name = await (await getObjectAsync(id)).common.name;
    let icon: string;

    switch (name) {
      case 'Presence':
        name = 'HomeMatic Presence';
        icon = 'mdi:location-enter';
        break;

      case 'Heating Period':
        icon = 'mdi:radiator';
      // Fall through to default.

      default:
        name = `HomeMatic ${name}`;
        break;
    }

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'switch',
          name: Lovelace.id(name),
          attr_device_class: 'switch',
          attr_icon: icon,
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
    const aliveMachine = Utils.english((await getObjectAsync(id)).common.name);
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
    if ((await getObjectAsync(id.replace(/\.[^.]*$/, ''))).type !== 'device') {
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

  $('state[id=ecovacs-deebot.*.control.spotArea_*]').each(async id => {
    if (!id.match(/\d$/)) {
      return;
    }

    const area = Utils.english((await getObjectAsync(id)).common.name);

    if (area.length === 1) {
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
