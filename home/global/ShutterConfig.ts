class ShutterConfig {
  public static sunnyDay = async () => {
    const maxDayTemperature =
      'daswetter.0.NextDays.Location_1.Day_1.Maximale_Temperatur_value';

    const maxTempToday = await getStateAsync(maxDayTemperature);

    return maxTempToday.val >= 25;
  };

  public static afternoon = () => getAstroDate('solarNoon', new Date(), 60);

  public static disable = async () => false;
}
