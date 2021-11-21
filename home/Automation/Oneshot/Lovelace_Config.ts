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

zigbeeLights();
zigbeeDoorContacts();

scenes();

homeMaticPresenceDetectors();

homeMaticVariables();

scripts();

pingedMachines();

kodi();

androidDebugBridge();

maxDayTemperature();

ecovacsDeebot();

function zigbeeLights() {
  $('state[id=zigbee.*.state](functions=light)').each(async id => {
    const deviceId = id.replace(/\.state$/, '');
    const name = (await getObjectAsync(deviceId)).common.name;

    const expect: Partial<iobJS.StateCommon> = { smartName: name };

    await check(deviceId, expect);
  });
}

function zigbeeDoorContacts() {
  $('state[id=zigbee.*.opened]').each(async id => {
    const deviceId = id.replace(/\.opened$/, '');
    const name = (await getObjectAsync(deviceId)).common.name;

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

function scenes() {
  $('state[id=scene.*][role=scene.state]').each(async id => {
    const name = id.replace(/^scene\.\d+\./, '').replace(/[._]/g, ' ');

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'scene',
          name: Lovelace.id(name),
          attr_friendly_name: name,
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
  $('state[id=hm-rega.*]').each(async id => {
    if (!id.match(/hm-rega\.\d\.\d+$/)) {
      return;
    }

    let name = await (await getObjectAsync(id)).common.name;
    let icon;
    switch (name) {
      case '${sysVarPresence}':
        name = 'HomeMatic Presence';
        icon = 'mdi:location-enter';
        break;

      case 'Heating Period':
        name = 'HomeMatic Heating Period';
        icon = 'mdi:radiator';
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

    const expect: Partial<iobJS.StateCommon> = {
      custom: {
        [AdapterIds.lovelace]: {
          enabled: true,
          entity: 'automation',
          name: Lovelace.id(lovelaceId),
          attr_friendly_name: friendlyName,
        },
      },
    };

    await check(id, expect);
  });
}

function pingedMachines() {
  $('state[id=ping.*.iobroker.*]').each(async id => {
    const aliveMachine = (await getObjectAsync(id)).common.name;
    const machine = aliveMachine.replace(/^Alive\s+/, '').toUpperCase();
    const name = `${machine} On`;

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
  $(
    'state[id=daswetter.*.NextDays.Location_1.Day_1.Maximale_Temperatur_value]',
  ).each(async id => {
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
  });
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

    const area = (await getObjectAsync(id)).common.name;

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

stopScript(undefined);
