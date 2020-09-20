// Requires AccuWeather adapter.
//
// Lovelace supports the AccuWeather adapter, but the device-detector does not
// support AccuWeather. We need to transform the AccuWeather objects to a format
// that both device-detector and lovelace support.
//
// https://github.com/iobroker-community-adapters/ioBroker.accuweather/issues/15
// https://github.com/ioBroker/ioBroker.type-detector/pull/8

import got from 'got';
import { concat, EMPTY, Observable, of } from 'rxjs';
import {
  distinctUntilChanged,
  distinctUntilKeyChanged,
  share,
  tap,
} from 'rxjs/operators';

const locationSource = '0_userdata.0.GW.Next Event.location';
const computedLocation = '0_userdata.0.GW.Next Event.computed_location';
const weatherSource = 'accuweather.0';
const lovelaceCompatibleWeatherDevice = 'alias.0.GW.Next Event Weather';

const deviceCreated = setObjectAsync(lovelaceCompatibleWeatherDevice, {
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

const allStatesCreated = channels.map(async (channel, index) => {
  const day = index + 1;

  await setObjectAsync(channel, {
    type: 'channel',
    common: { name: `Day ${day}` },
    native: {},
  });
  log(`Created channel ${channel}`);

  const statesCreated = Object.entries(states).map(async ([state, def]) => {
    const id = `${channel}.${state}`;

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

    await setObjectAsync(id, {
      type: 'state',
      common: common,
      native: {},
    });

    log(`Created state ${id}`);
  });

  return Promise.all(statesCreated);
});

const httpRequestCache = new Map();

async function searchLocation(
  apiKey: string,
  location: string,
): Promise<[string, string]> {
  try {
    const result = ((await got
      .get('http://dataservice.accuweather.com/locations/v1/search', {
        cache: httpRequestCache,
        retry: 0,
        searchParams: { apikey: apiKey, q: location, language: 'de' },
      })
      .json<any[]>()) as unknown) as any[];

    if (!result.length) {
      log(`No location ID for ${location}`, 'error');
      return;
    }

    const key = result[0].Key;
    const name = result[0].LocalizedName;

    return [key, name];
  } catch (e) {
    log(e.response.body, 'error');
    return [undefined, undefined];
  }
}

async function updateComputedLocation(locationName: any): Promise<void> {
  await setStateAsync(computedLocation, locationName, true);

  log(`Updated computed location in user data: ${locationName}`);

  await extendObjectAsync(lovelaceCompatibleWeatherDevice, {
    common: { smartName: locationName },
  });

  log(`Updated computed location in weather forecast: ${locationName}`);
}

function initialLocation(): Observable<string> {
  const location = getState(locationSource);

  if (location.notExist) {
    return EMPTY;
  }

  return of(location.val);
}

const locationUpdates = new Observable<string>(observer => {
  on({ id: locationSource, change: 'ne', ack: true }, event => {
    observer.next(event.state.val);
  });
}).pipe(share());

const locationChanges = concat(initialLocation(), locationUpdates).pipe(
  distinctUntilChanged(),
  tap(async location => {
    if (!location.length) {
      log(`No location for event `);
      await updateComputedLocation('');
      return;
    }

    const adapterConfigId = `system.adapter.${weatherSource}`;
    const adapterConfig = await getObjectAsync(adapterConfigId);

    if (adapterConfig.common['custom']?.address === location) {
      log(`Location did not change: ${location}`);
      return;
    }

    // Get AccuWeather location from address.
    let [locationKey, locationName] = await searchLocation(
      adapterConfig.native.apiKey,
      location,
    );

    if (!locationKey || !locationName) {
      return;
    }

    await extendObjectAsync(adapterConfigId, {
      native: { loKey: locationKey },
      common: { custom: { address: location } },
    });
    log(`Updated location key: ${locationKey}`);

    await setStateAsync(`${weatherSource}.updateDaily`, true, false);

    await updateComputedLocation(locationName);
  }),
);

Promise.all([deviceCreated, allStatesCreated]).then(() => {
  log('Subscribing to events');

  const subscription = locationChanges.subscribe();

  onStop(() => subscription.unsubscribe());
});
