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
import { distinctUntilChanged, share, tap } from 'rxjs/operators';

const locationSource = '0_userdata.0.GW.Next Event.location';
const computedLocation = '0_userdata.0.GW.Next Event.computed_location';
const weatherSource = 'accuweather.0';
const lovelaceCompatibleWeatherDevice = 'alias.0.GW.Next Event Weather';

const objects: ObjectDefinitionRoot = {
  'Next Event Weather': {
    type: 'device',
    common: { name: 'Next Event Weather' },
    native: {},
    enumIds: ['enum.rooms.fake', 'enum.functions.Weather'],
    nested: [...Array(5)]
      .map((_, index) => {
        return [index, index + 1];
      })
      .reduce<ObjectDefinitionRoot>((acc, [day, humanizedDay]) => {
        const state: (def: any) => ObjectDefinition = def => {
          const common = {
            name: '',
            read: true,
            write: false,
            role: def.role,
            type: def.type as iobJS.CommonType,
            unit: def.unit,
            alias: {
              id: def.source,
              read: def.read || 'val',
            },
          };

          return {
            type: 'state',
            common: common,
            native: {},
          };
        };

        acc[`Day_${humanizedDay}`] = {
          type: 'channel',
          common: { name: `Day ${humanizedDay}` },
          native: {},
          nested: {
            location: state({
              type: 'string',
              role: 'location',
              source: '0_userdata.0.GW.Next Event.computed_location',
            }),
            date: state({
              type: 'string',
              role: `date.forecast.${day}`,
              source: `${weatherSource}.Summary.DateTime_d${humanizedDay}`,
            }),
            state: state({
              type: 'string',
              role: `weather.state.forecast.${day}`,
              source: `${weatherSource}.Summary.WeatherText_d${humanizedDay}`,
            }),
            icon: state({
              type: 'string',
              role: `weather.icon.forecast.${day}`,
              source: `${weatherSource}.Summary.WeatherIconURL_d${humanizedDay}`,
              read:
                'val.startsWith("http://") ? val.replace("http://", "https://") : val',
            }),
            temp_min: state({
              type: 'number',
              unit: '°C',
              role: `value.temperature.min.forecast.${day}`,
              source: `${weatherSource}.Summary.TempMin_d${humanizedDay}`,
            }),
            temp_max: state({
              type: 'number',
              unit: '°C',
              role: `value.temperature.max.forecast.${day}`,
              source: `${weatherSource}.Summary.TempMax_d${humanizedDay}`,
            }),
            precipitation_chance: state({
              type: 'number',
              unit: '%',
              role: `value.precipitation.forecast.${day}`,
              source: `${weatherSource}.Summary.PrecipitationProbability_d${humanizedDay}`,
            }),
            precipitation: state({
              type: 'number',
              unit: 'mm',
              role: `value.precipitation.forecast.${day}`,
              source: `${weatherSource}.Summary.TotalLiquidVolume_d${humanizedDay}`,
            }),
            wind_direction_bearing: state({
              type: 'number',
              unit: '°',
              role: `value.direction.wind.forecast.${day}`,
              source: `${weatherSource}.Summary.WindDirection_d${humanizedDay}`,
            }),
            wind_direction: state({
              type: 'string',
              role: `weather.direction.wind.forecast.${day}`,
              source: `${weatherSource}.Summary.WindDirectionStr_d${humanizedDay}`,
            }),
            wind_speed: state({
              type: 'number',
              unit: 'km/h',
              role: `value.speed.wind.forecast.${day}`,
              source: `${weatherSource}.Summary.WindSpeed_d${humanizedDay}`,
            }),
          },
        };

        return acc;
      }, {} as ObjectDefinitionRoot),
  },
};

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

    const previousLocation = adapterConfig.common['custom']?.location;
    if (previousLocation === location) {
      log(`Location did not change: ${location}`);

      const previousLocationName =
        adapterConfig.common['custom']?.computed_location;
      if (previousLocationName) {
        await updateComputedLocation(previousLocationName);
      }

      return;
    }
    log(`Location changed from "${previousLocation}" to "${location}"`);

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
      common: {
        custom: { location: location, computed_location: locationName },
      },
    });
    log(`Updated location key: ${locationKey}`);

    await setStateAsync(`${weatherSource}.updateDaily`, true, false);

    await updateComputedLocation(locationName);
  }),
);

await ObjectCreator.create(objects, 'alias.0.GW');

log('Subscribing to events');
const subscription = locationChanges.subscribe();

onStop(() => subscription.unsubscribe());
