log(`Next sunset: ${getAstroDate('sunsetStart')}`);
const sunset = schedule({ astro: 'sunsetStart' }, async () => {
  await setStateAsync('scene.0.Shutters.Night', true);
});

log(`Next sunrise: ${getAstroDate('sunrise')}`);
const sunrise = schedule({ astro: 'sunrise' }, async () => {
  const maxTempToday = await getStateAsync(
    'daswetter.0.NextDays.Location_1.Day_1.Maximale_Temperatur_value',
  );

  if (maxTempToday.val >= 25) {
    const noonPlusOneHour = getAstroDate('solarNoon', new Date().valueOf(), 60);

    Notify.mobile(
      `Sunny day shutters until ${noonPlusOneHour.toLocaleString()}`,
    );

    await setStateAsync('scene.0.Shutters.Sunny_day', true);

    const setDayShutters = schedule(
      formatDate(noonPlusOneHour, 'm h * * *'),
      async () => {
        Notify.mobile('Setting shutters to sunny day afternoon levels');

        await setStateAsync('scene.0.Shutters.Sunny_day_afternoon', true);
        if (!clearSchedule(setDayShutters)) {
          log(
            'Error clearing schedule to return shutters to normal day levels',
            'error',
          );
        }
      },
    );
  } else {
    await setStateAsync('scene.0.Shutters.Day', true);
  }
});

onStop(() => [sunset, sunrise].forEach(scheduled => clearSchedule(scheduled)));
