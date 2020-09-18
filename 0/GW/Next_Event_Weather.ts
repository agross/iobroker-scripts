// Requires AccuWeather adapter.
//
// Lovelace supports the AccuWeather adapter, but the device-detector does not
// support AccuWeather. We need to transform the AccuWeather objects to a format
// that both device-detector and lovelace support.
//
// https://github.com/iobroker-community-adapters/ioBroker.accuweather/issues/15
// https://github.com/ioBroker/ioBroker.type-detector/pull/8

import got from 'got';

const locationSource = '0_userdata.0.GW.Next Event.location';
const computedLocation = '0_userdata.0.GW.Next Event.computed_location';
const weatherSource = 'accuweather.0';
const lovelaceCompatibleWeatherDevice = 'alias.0.GW.Next Event Weather';

setObject(lovelaceCompatibleWeatherDevice, {
  type: 'device',
  common: { name: 'Next Event Weather' },
  native: {},
});

const channels = [...Array(5)].map((_, i) => {
  return `${lovelaceCompatibleWeatherDevice}.Day_${i}`;
});

const states = {
  location: {
    type: 'string',
    role: _index => 'location',
    source: _index => '0_userdata.0.GW.Next Event.computed_location',
  },
  date: {
    type: 'string',
    role: index => `date.forecast.${index}`,
    source: index => `${weatherSource}.Summary.DateTime_d${index + 1}`,
  },
  state: {
    type: 'string',
    role: index => `weather.state.forecast.${index}`,
    source: index => `${weatherSource}.Summary.WeatherText_d${index + 1}`,
  },
  icon: {
    type: 'string',
    role: index => `weather.icon.forecast.${index}`,
    source: index => `${weatherSource}.Summary.WeatherIconURL_d${index + 1}`,
    read: _index =>
      'val.startsWith("http://") ? val.replace("http://", "https://") : val',
  },
  temp_min: {
    type: 'number',
    unit: '°C',
    role: index => `value.temperature.min.forecast.${index}`,
    source: index => `${weatherSource}.Summary.TempMin_d${index + 1}`,
  },
  temp_max: {
    type: 'number',
    unit: '°C',
    role: index => `value.temperature.max.forecast.${index}`,
    source: index => `${weatherSource}.Summary.TempMax_d${index + 1}`,
  },
  precipitation_chance: {
    type: 'number',
    unit: '%',
    role: index => `value.precipitation.forecast.${index}`,
    source: index =>
      `${weatherSource}.Summary.PrecipitationProbability_d${index + 1}`,
  },
  precipitation: {
    type: 'number',
    unit: 'mm',
    role: index => `value.precipitation.forecast.${index}`,
    source: index => `${weatherSource}.Summary.TotalLiquidVolume_d${index + 1}`,
  },
  wind_direction_bearing: {
    type: 'number',
    unit: '°',
    role: index => `value.direction.wind.forecast.${index}`,
    source: index => `${weatherSource}.Summary.WindDirection_d${index + 1}`,
  },
  wind_direction: {
    type: 'string',
    role: index => `weather.direction.wind.forecast.${index}`,
    source: index => `${weatherSource}.Summary.WindDirectionStr_d${index + 1}`,
  },
  wind_speed: {
    type: 'number',
    unit: 'km/h',
    role: index => `value.speed.wind.forecast.${index}`,
    source: index => `${weatherSource}.Summary.WindSpeed_d${index + 1}`,
  },
};

channels.forEach((channel, index) => {
  const day = index + 1;

  setObject(channel, {
    type: 'channel',
    common: { name: `Day ${day}` },
    native: {},
  });

  Object.entries(states).forEach(([state, def]) => {
    const common = {
      name: '',
      read: true,
      write: false,
      role: def.role(index),
      type: def.type as iobJS.CommonType,
      unit: def['unit'],
      alias: {
        id: def.source(index),
        read: (def['read'] && def['read'](index)) || 'val',
      },
    };

    setObject(`${channel}.${state}`, {
      type: 'state',
      common: common,
      native: {},
    });
  });
});

const httpRequestCache = new Map();

async function searchLocationKey(
  apiKey: string,
  location: string,
): Promise<any[]> {
  try {
    return ((await got
      .get('http://dataservice.accuweather.com/locations/v1/search', {
        cache: httpRequestCache,
        retry: 0,
        searchParams: { apikey: apiKey, q: location },
      })
      .json<any[]>()) as unknown) as any[];
  } catch (e) {
    log(e.response.body, 'error');
    return [];
  }
}

function updateComputedLocation(locationName: any): Promise<any> {
  return new Promise((resolve, reject) =>
    setState(computedLocation, locationName, true, err => {
      if (err) {
        log(
          `Could not set computed location '${locationName}': ${err}`,
          'error',
        );
        reject(err);
        return;
      }

      log(`Updated computed location: ${locationName}`);
      resolve();
    }),
  );
}

on(
  { id: locationSource, change: 'ne', ack: true },
  async (location: iobJS.ChangedStateObject<string>) => {
    const eventLocation = location.state.val;
    if (!eventLocation.length) {
      log(`No location for event ${location.id}`);
      await updateComputedLocation('');
      return;
    }

    const adapterConfigId = `system.adapter.${weatherSource}`;
    const adapterConfig = getObject(adapterConfigId);

    // Get AccuWeather location from address.
    let searchResult = await searchLocationKey(
      adapterConfig.native.apiKey,
      eventLocation,
    );

    if (!searchResult.length) {
      log(`No location ID for ${location.state.val}`, 'error');
      return;
    }

    const locationKey = searchResult[0].Key;
    extendObject(adapterConfigId, { native: { loKey: locationKey } }, err => {
      if (err) {
        log(`Could not set new location key '${locationKey}': ${err}`, 'error');
        return;
      }

      log(`Updated location key: ${locationKey}`);

      setState(`${weatherSource}.updateDaily`, true, false);
    });

    const locationName = searchResult[0].LocalizedName;
    updateComputedLocation(locationName);
  },
);
