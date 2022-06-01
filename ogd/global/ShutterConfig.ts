class ShutterConfig {
  public static sunnyDay = async () => {
    const maxDayTemperature =
      'daswetter.0.NextDays.Location_1.Day_1.Maximale_Temperatur_value';

    const maxTempToday = await getStateAsync(maxDayTemperature);

    return maxTempToday.val >= 25;
  };

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
