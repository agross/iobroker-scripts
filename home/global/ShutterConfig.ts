class ShutterConfig {
  public static sunnyDay = async () => {
    const maxDayTemperature =
      'pirate-weather.0.weather.daily.00.temperatureMax';

    const maxTempToday = await getStateAsync(maxDayTemperature);

    return maxTempToday.val >= 25;
  };

  public static get sunnyDayExceptions() {
    return [
      {
        text: '🕞 Afternoon Levels',
        callback_data: 'shutters-afternoon',
        callbackReceived: () => {
          setState('scene.0.Shutters.Day', true);
        },
      },
      {
        text: '⛅ Not Sunny',
        callback_data: 'shutters-not-sunny',
        callbackReceived: () => {
          setState('scene.0.Shutters.Day', true);
        },
      },
      {
        text: '🚪 Access Balcony',
        callback_data: 'shutters-balcony',
        callbackReceived: () => {
          setState('scene.0.Living Room.Shutters_With_Balcony_Access', true);
        },
      },
    ];
  }

  public static afternoon = () => getAstroDate('solarNoon', new Date(), 60);

  public static disable = async () => false;
}
