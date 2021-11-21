// Requires AccuWeather adapter.
//
// Lovelace supports the AccuWeather adapter, but the device-detector does not
// support AccuWeather. We need to transform the AccuWeather objects to a format
// that both device-detector and lovelace support.
//
// https://github.com/iobroker-community-adapters/ioBroker.accuweather/issues/15
// https://github.com/ioBroker/ioBroker.type-detector/pull/8

import got from 'got';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';

const location = {
  root: '0_userdata.0.GW.Next Event',
  source: 'location',
  computed: 'computed-location',
  computed_based_on: 'computed-location-source-data',
};
const weatherSource = 'accuweather.0';
const lovelaceCompatibleWeatherDevice = 'alias.0.GW.Next Event Weather';

function nextEventExtension(): ObjectDefinitionRoot {
  const stateObjects: (channel: string) => ObjectDefinitionRoot = channel => {
    const channelStates: { [id: string]: any } = {
      [location.computed_based_on]: {
        name: 'Data used to determine computed event location ',
        type: 'string',
      },
      [location.computed]: {
        name: 'Computed event location',
        type: 'string',
      },
    };

    return Object.entries(channelStates).reduce((acc, [stateId, def]) => {
      acc[stateId] = {
        type: 'state',
        common: {
          name: def.name,
          read: true,
          write: false,
          role: 'value',
          type: def.type as iobJS.CommonType,
          custom: {
            [AdapterIds.lovelace]: {
              enabled: true,
              entity: 'sensor',
              name: Lovelace.id(`${channel} ${def.name}`),
              attr_device_class: def.device_class,
            },
          },
        },
        native: {},
        script: def.script,
      };

      return acc;
    }, {});
  };

  return stateObjects('Next Event');
}

const weather: ObjectDefinitionRoot = {
  'Next Event Weather': {
    type: 'device',
    common: { name: 'Next Event Weather' },
    native: {},
    enumIds: ['enum.rooms.fake', 'enum.functions.weather'],
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
              source: `${location.root}.${location.computed}`,
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
              read: 'val.startsWith("http://") ? val.replace("http://", "https://") : val',
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
    const result = (await got
      .get('http://dataservice.accuweather.com/locations/v1/search', {
        cache: httpRequestCache,
        retry: 0,
        searchParams: { apikey: apiKey, q: location, language: 'de' },
      })
      .json<any[]>()) as unknown as any[];

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

async function updateComputedLocation(
  locationName: string,
  basedOn: string,
): Promise<void> {
  await setStateAsync(
    `${location.root}.${location.computed}`,
    locationName,
    true,
  );
  await setStateAsync(
    `${location.root}.${location.computed_based_on}`,
    basedOn,
    true,
  );

  log(`Updated computed location in user data: ${locationName}`);

  await extendObjectAsync(lovelaceCompatibleWeatherDevice, {
    common: { smartName: locationName },
  });

  log(`Updated computed location in weather forecast: ${locationName}`);
}

const locationChanges = combineLatest([
  new Stream<string>(`${location.root}.${location.source}`).stream,
  new Stream<string>(`${location.root}.${location.computed_based_on}`).stream,
]).pipe(
  map(([next, computed_based_on]) => {
    return { next: next, computed_based_on: computed_based_on };
  }),
  distinctUntilChanged((x, y) => x.next === y.next),
  tap(async loc => {
    if (!loc.next.length) {
      log('No location for next event');
      await updateComputedLocation('', '');
      return;
    }

    if (loc.next === loc.computed_based_on) {
      log(`Location did not change: ${loc.next}`);
      return;
    }

    log(`Location changed from "${loc.computed_based_on}" to "${loc.next}"`);

    const adapterConfigId = `system.adapter.${weatherSource}`;
    const adapterConfig = await getObjectAsync(adapterConfigId);

    // Get AccuWeather location from address.
    let [locationKey, locationName] = await searchLocation(
      adapterConfig.native.apiKey,
      loc.next,
    );

    if (!locationKey || !locationName) {
      return;
    }

    await extendObjectAsync(adapterConfigId, {
      native: { loKey: locationKey },
    });
    log(`Updated location key: ${locationKey}`);

    await setStateAsync(`${weatherSource}.updateDaily`, true, false);

    await updateComputedLocation(locationName, loc.next);
  }),
);

await ObjectCreator.create(nextEventExtension(), location.root);
await ObjectCreator.create(weather, 'alias.0.GW');

log('Subscribing to events');
const subscription = locationChanges.subscribe();

onStop(() => subscription.unsubscribe());
