log(`Next sunset: ${getAstroDate('sunsetStart')}`);
const sunset = schedule({ astro: 'sunsetStart' }, async () => {
  await setStateAsync('scene.0.Shutters.Night', true);
});

log(`Next sunrise: ${getAstroDate('sunrise')}`);
const sunrise = schedule({ astro: 'sunrise' }, async () => {
  await setStateAsync('scene.0.Shutters.Day', true);
});

onStop(() => [sunset, sunrise].forEach(scheduled => clearSchedule(scheduled)));
