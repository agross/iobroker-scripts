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
    await setStateAsync('scene.0.Shutters.Sunny_day', true);
    Notifier.notify('It is going to be sunny today!');
  } else {
    await setStateAsync('scene.0.Shutters.Day', true);
  }
});

onStop(() => [sunset, sunrise].forEach(scheduled => clearSchedule(scheduled)));
