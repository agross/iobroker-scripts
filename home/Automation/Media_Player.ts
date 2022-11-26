import got from 'got';
import path from 'path';
import { combineLatest } from 'rxjs';
import { map, sampleTime, tap } from 'rxjs/operators';

const config = {
  tv: 'lgtv.0',
  kodi: 'kodi.0',
  lovelace: 'lovelace.0',
};

function lgtvObjectDefinition(): ObjectDefinitionRoot {
  return [config.tv].reduce((acc, device) => {
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

function kodiUserData(): ObjectDefinitionRoot {
  return [config.kodi].reduce((acc, device) => {
    const states: {
      [id: string]: iobJS.StateCommon;
    } = {
      cover: {
        name: 'Track cover or fanart cover as a fallback',
        role: 'media.cover',
        type: 'string',
        read: true,
        write: false,
        def: JSON.stringify(null),
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

function kodiObjectDefinition(): ObjectDefinitionRoot {
  return [config.kodi].reduce((acc, device) => {
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
          id: `0_userdata.0.${device}.cover`,
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
          id: `0_userdata.0.${device}.cover`,
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
await ObjectCreator.create(kodiUserData(), '0_userdata.0');
await ObjectCreator.create(kodiObjectDefinition(), 'alias.0');

const fanart = new Stream<string>(`${config.kodi}.info.fanart`).stream;
const track = new Stream<string>(`${config.kodi}.info.thumbnail`).stream;

const cover = combineLatest([fanart, track])
  .pipe(
    sampleTime(2000),
    map(async ([fanart, track]) => {
      const kodiImageService = async uri => {
        try {
          const current = (
            await getStateAsync(`0_userdata.0.${config.kodi}.cover`)
          ).val;

          // Without this check we would delete all files from config.lovelace.
          if (current && current.length) {
            const file = `cards/${path.basename(current)}`;
            await delFileAsync(config.lovelace, file);
            log(`Deleted current cover ${file}`);
          }
        } catch (error) {}

        if (!uri || !uri.length) {
          return undefined;
        }

        const kodiConfig = await getObjectAsync(
          `system.adapter.${config.kodi}`,
        );
        const native = kodiConfig.native;
        const imageUri = `http://${native.ip}:${
          native.portweb || 8081
        }/image/${encodeURIComponent(uri)}`;

        let buffer: Buffer;
        try {
          buffer = await got(imageUri, {
            username: native.login,
            password: native.password,
          }).buffer();
        } catch (error) {
          log(`Could not get cover from Kodi ${imageUri}: ${error}`, 'error');
          return undefined;
        }

        const next = `cards/kodi-cover-binary-${Date.now()}.jpg`;
        try {
          log(`Writing next cover: ${next}`);
          writeFileAsync(config.lovelace, next, buffer);

          return `/local/custom_ui/${path.basename(next)}`;
        } catch (error) {
          log(`Could not write file ${next}: ${error}`, 'error');
        }

        return undefined;
      };

      const directLink = uri => {
        return decodeURIComponent(uri.replace(/^image:\/\//, ''))
          .replace(/\/$/, '')
          .replace(/^http:\/\//, 'https://');
      };

      log(`New cover data for track ${track} and fanart ${fanart}`);

      return (await kodiImageService(track)) || directLink(fanart);
    }),
    tap(async art => {
      setState(`0_userdata.0.${config.kodi}.cover`, await art, true);
    }),
  )
  .subscribe();

onStop(() => {
  [cover].forEach(x => x.unsubscribe());
});
