class ShutterConfig {
  private static readonly MAY = 4;
  private static readonly AUGUST = 7;

  public static sunnyDay = async () => {
    const month = new Date().getMonth();

    if (month < ShutterConfig.MAY || month > ShutterConfig.AUGUST) {
      log('Outside of warm months');
      return false;
    }

    const maxDayTemperature =
      'pirate-weather.0.weather.daily.00.temperatureMax';

    const maxTempToday = await getStateAsync(maxDayTemperature);

    return maxTempToday.val >= 25;
  };

  public static get sunnyDayExceptions() {
    return [
      {
        text: '⛅ Not Sunny',
        callback_data: 'shutters-not-sunny',
        callbackReceived: () => {
          setState('scene.0.Shutters.Day', true);
        },
      },
    ];
  }

  public static afternoon = () => getAstroDate('sunrise', new Date(), 4 * 60);

  public static disable = async () => {
    var absent = (await getStateAsync('0_userdata.0.long-term-absence')).val;
    if (absent !== false) {
      log('Shutter automation disabled');
      return true;
    }

    return false;
  };
}
