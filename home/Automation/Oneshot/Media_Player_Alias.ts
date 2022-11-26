function lgtvObjectDefinition(): ObjectDefinitionRoot {
  return ['lgtv.0'].reduce((acc, device) => {
    const states: {
      [id: string]: iobJS.StateCommon;
    } = {
      state: {
        alias: {
          id: {
            read: `${device}.info.connection`,
            write: `${device}.states.power`,
          },
        },
        role: 'media.state',
        type: 'boolean',
        read: true,
        write: true,
        name: 'State',
      },
      // Needs a cover to be detected as a media player by the type detector.
      cover: {
        alias: {
          id: `${device}.info.connection`,
          read: '""',
          // No write function makes this read-only.
        },
        role: 'media.cover',
        type: 'string',
        read: true,
        write: false,
        name: 'Cover',
      },
      mute: {
        alias: {
          id: `${device}.states.mute`,
        },
        role: 'media.mute',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Mute',
      },
      power: {
        alias: {
          id: { read: `${device}.states.on`, write: `${device}.states.power` },
        },
        role: 'switch',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Power',
        custom: {
          [AdapterIds.lovelace]: {
            enabled: true,
            entity: 'switch',
            name: Lovelace.id('Living Room TV'),
            attr_device_class: 'outlet',
            attr_icon: 'mdi:television',
            attr_friendly_name: 'TV',
          },
        },
      },
      volume: {
        alias: {
          id: `${device}.states.volume`,
        },
        role: 'level.volume',
        type: 'number',
        read: true,
        write: true,
        min: 0,
        max: 100,
        name: 'Volume',
      },
    };

    acc[device] = {
      type: 'device',
      native: {},
      common: { name: 'Living Room TV', role: 'device' },
      nested: Object.entries(states).reduce((acc, [id, common]) => {
        acc[id] = { type: 'state', native: {}, common: common };
        return acc;
      }, {} as ObjectDefinitionRoot),
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

function kodiObjectDefinition(): ObjectDefinitionRoot {
  return ['kodi.0'].reduce((acc, device) => {
    const states: {
      [id: string]: iobJS.StateCommon;
    } = {
      state: {
        alias: {
          id: {
            read: `${device}.state`,
            write: `${device}.pause`,
          },
          read: 'val === "play" ? 1 : val === "stop" ? 2 : 0',
          write: 'true',
        },
        role: 'media.state',
        type: 'number',
        read: true,
        write: true,
        name: 'State',
      },
      cover: {
        alias: {
          id: `${device}.info.fanart`,
          read: "decodeURIComponent(val.replace(/^image:\\/\\//, '')) \
                   .replace(/\\/$/, '') \
                   .replace(/^http:\\/\\//, 'https://')",
          // No write function makes this read-only.
        },
        role: 'media.cover',
        type: 'string',
        read: true,
        write: false,
        name: 'Cover',
      },
      'cover-big': {
        alias: {
          id: `${device}.info.fanart`,
          read: "decodeURIComponent(val.replace(/^image:\\/\\//, '')) \
                   .replace(/\\/$/, '') \
                   .replace(/^http:\\/\\//, 'https://')",
          // No write function makes this read-only.
          // http://firetv:8080/image/image%3A%2F%2Fsmb%253a%252f%252frouter%252fagross%252fnextcloud%252fMusic%252fMassive%2520Attack%2520-%2520100th%2520Window%252fcover.jpg%2F
        },
        role: 'media.cover.big',
        type: 'string',
        read: true,
        write: false,
        name: 'Big cover',
      },
      mute: {
        alias: {
          id: `${device}.mute`,
        },
        role: 'media.mute',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Mute',
      },
      play: {
        alias: {
          id: `${device}.play`,
        },
        role: 'button.play',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Play',
      },
      pause: {
        alias: {
          id: `${device}.pause`,
        },
        role: 'button.pause',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Pause',
      },
      stop: {
        alias: {
          id: `${device}.stop`,
        },
        role: 'button.stop',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Stop',
      },
      next: {
        alias: {
          id: `${device}.next`,
        },
        role: 'button.next',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Next',
      },
      previous: {
        alias: {
          id: `${device}.previous`,
        },
        role: 'button.prev',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Previous',
      },
      shuffle: {
        alias: {
          id: `${device}.shuffle`,
        },
        role: 'media.mode.shuffle',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Shuffle',
      },
      repeat: {
        alias: {
          id: `${device}.repeat`,
          read: 'val === "off" ? 0 : val === "one" ? 1 : 2',
          write: 'val === 0 ? "off" : val === 1 ? "one" : "all"',
        },
        role: 'media.mode.repeat',
        type: 'number',
        read: true,
        write: true,
        name: 'Repeat',
      },
      artist: {
        alias: {
          id: `${device}.info.artist`,
        },
        role: 'media.artist',
        type: 'string',
        read: true,
        write: false,
        name: 'Artist',
      },
      album: {
        alias: {
          id: `${device}.info.album`,
        },
        role: 'media.album',
        type: 'string',
        read: true,
        write: false,
        name: 'Album',
      },
      title: {
        alias: {
          id: `${device}.info.title`,
        },
        role: 'media.title',
        type: 'string',
        read: true,
        write: false,
        name: 'Title',
      },
      duration: {
        alias: {
          id: `${device}.info.playing_time_total`,
          read: 'val.split(":").reduce((acc, time, index) => (60 * acc) + +time, 0)',
        },
        role: 'media.duration',
        type: 'number',
        unit: 's',
        read: true,
        write: false,
        name: 'Duration',
      },
      elapsed: {
        alias: {
          id: `${device}.info.playing_time`,
          read: 'val.split(":").reduce((acc, time) => (60 * acc) + +time, 0)',
        },
        role: 'media.elapsed',
        type: 'number',
        unit: 's',
        read: true,
        write: false,
        name: 'Duration',
      },
      seek: {
        alias: {
          id: `${device}.seek`,
          read: 'Math.round(val)',
          write: 'val',
        },
        role: 'media.seek',
        type: 'number',
        unit: '%',
        read: true,
        write: true,
        name: 'Seek',
      },
      track: {
        alias: {
          id: `${device}.position`,
        },
        role: 'media.track',
        type: 'string',
        read: true,
        write: true,
        name: 'Duration',
      },
      volume: {
        alias: {
          id: `${device}.volume`,
        },
        role: 'level.volume',
        type: 'number',
        read: true,
        write: true,
        min: 0,
        max: 100,
        name: 'Volume',
      },
    };

    acc[device] = {
      type: 'device',
      native: {},
      common: { name: 'Kodi', role: 'device' },
      nested: Object.entries(states).reduce((acc, [id, common]) => {
        acc[id] = { type: 'state', native: {}, common: common };
        return acc;
      }, {} as ObjectDefinitionRoot),
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

export {};
await ObjectCreator.create(lgtvObjectDefinition(), 'alias.0');
await ObjectCreator.create(kodiObjectDefinition(), 'alias.0');

stopScript(undefined);
