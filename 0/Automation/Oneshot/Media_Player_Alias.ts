function lgtvObjectDefinition(): ObjectDefinitionRoot {
  function deviceId(id: string): string {
    return id.replace(/\.[^.]*$/, '').replace(/\.(cmnd|tele|stat)\./, '.');
  }

  return ['lgtv.0'].reduce((acc, stateId) => {
    const device = deviceId(stateId);

    const deviceStates: {
      [id: string]: iobJS.StateCommon & iobJS.AliasCommon & iobJS.CustomCommon;
    } = {
      state: {
        alias: {
          id: 'lgtv.0.info.connection',
        },
        role: 'media.state',
        type: 'boolean',
        read: true,
        write: false,
        name: 'State',
      },
      cover: {
        alias: {
          id: 'lgtv.0.info.connection',
          read: '""',
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
          id: 'lgtv.0.info.connection',
          read: '""',
          // No write function makes this read-only.
        },
        role: 'media.cover.big',
        type: 'string',
        read: true,
        write: false,
        name: 'Big cover',
      },
      mute: {
        alias: {
          id: 'lgtv.0.states.mute',
        },
        role: 'media.mute',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Mute',
      },
      power: {
        alias: {
          id: { read: 'lgtv.0.states.on', write: 'lgtv.0.states.power' },
        },
        role: 'switch',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Power',
      },
      volume: {
        alias: {
          id: 'lgtv.0.states.volume',
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
      common: { name: 'Living Room TV Testing', role: 'device' },
      nested: Object.entries(deviceStates).reduce((acc, [id, common]) => {
        acc[id] = { type: 'state', native: {}, common: common };
        return acc;
      }, {} as ObjectDefinitionRoot),
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

function kodiObjectDefinition(): ObjectDefinitionRoot {
  function deviceId(id: string): string {
    return id.replace(/\.[^.]*$/, '').replace(/\.(cmnd|tele|stat)\./, '.');
  }

  return ['kodi.0'].reduce((acc, stateId) => {
    const device = deviceId(stateId);

    const deviceStates: {
      [id: string]: iobJS.StateCommon & iobJS.AliasCommon & iobJS.CustomCommon;
    } = {
      state: {
        alias: {
          id: 'kodi.0.state',
          read: 'val === "play" ? 1 : val === "stop" ? 2 : 0',
        },
        role: 'media.state',
        type: 'number',
        read: true,
        write: false,
        name: 'State',
      },
      cover: {
        alias: {
          id: 'kodi.0.info.fanart',
          read:
            "decodeURIComponent(val.replace(/^image:\\/\\//, '')).replace(/\\/$/, '').replace(/^http:\\/\\//, 'https://')",
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
          id: 'kodi.0.info.fanart',
          read:
            "decodeURIComponent(val.replace(/^image:\\/\\//, '')).replace(/\\/$/, '').replace(/^http:\\/\\//, 'https://')",
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
          id: 'kodi.0.mute',
        },
        role: 'media.mute',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Mute',
      },
      play: {
        alias: {
          id: 'kodi.0.play',
        },
        role: 'button.play',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Play',
      },
      pause: {
        alias: {
          id: 'kodi.0.pause',
        },
        role: 'button.pause',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Pause',
      },
      stop: {
        alias: {
          id: 'kodi.0.stop',
        },
        role: 'button.stop',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Stop',
      },
      next: {
        alias: {
          id: 'kodi.0.next',
        },
        role: 'button.next',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Next',
      },
      previous: {
        alias: {
          id: 'kodi.0.previous',
        },
        role: 'button.prev',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Previous',
      },
      shuffle: {
        alias: {
          id: 'kodi.0.shuffle',
        },
        role: 'media.mode.shuffle',
        type: 'boolean',
        read: true,
        write: true,
        name: 'Shuffle',
      },
      repeat: {
        alias: {
          id: 'kodi.0.repeat',
        },
        role: 'media.mode.repeat',
        type: 'number',
        read: true,
        write: true,
        name: 'Shuffle',
      },
      artist: {
        alias: {
          id: 'kodi.0.info.artist',
        },
        role: 'media.artist',
        type: 'string',
        read: true,
        write: false,
        name: 'Artist',
      },
      album: {
        alias: {
          id: 'kodi.0.info.album',
        },
        role: 'media.album',
        type: 'string',
        read: true,
        write: false,
        name: 'Album',
      },
      title: {
        alias: {
          id: 'kodi.0.info.title',
        },
        role: 'media.title',
        type: 'string',
        read: true,
        write: false,
        name: 'Title',
      },
      duration: {
        alias: {
          id: 'kodi.0.info.playing_time_total',
          read: 'val.split(":").reduce((acc, time) => (60 * acc) + +time, 0)',
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
          id: 'kodi.0.info.playing_time',
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
          id: 'kodi.0.seek',
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
          id: 'kodi.0.position',
        },
        role: 'media.track',
        type: 'string',
        read: true,
        write: true,
        name: 'Duration',
      },
      volume: {
        alias: {
          id: 'kodi.0.volume',
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
      common: { name: 'Kodi Testing', role: 'device' },
      nested: Object.entries(deviceStates).reduce((acc, [id, common]) => {
        acc[id] = { type: 'state', native: {}, common: common };
        return acc;
      }, {} as ObjectDefinitionRoot),
    };

    return acc;
  }, {} as ObjectDefinitionRoot);
}

export {};
await ObjectCreator.create(lgtvObjectDefinition(), 'alias.0.Testing');
await ObjectCreator.create(kodiObjectDefinition(), 'alias.0.Testing');

stopScript(undefined);
