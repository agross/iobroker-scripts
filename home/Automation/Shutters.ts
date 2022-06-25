const config = {
  sunnyDay: ShutterConfig.sunnyDay,
  afternoon: ShutterConfig.afternoon,
  scenes: {
    night: 'scene.0.Shutters.Night',
    day: 'scene.0.Shutters.Day',
    sunnyDay: 'scene.0.Shutters.Sunny_Day',
    sunnyDayAfternoon: 'scene.0.Shutters.Sunny_Day_Afternoon',
  },
  disable: ShutterConfig.disable,
};

log(`Next sunset: ${getAstroDate('sunsetStart')}`);
const sunset = schedule({ astro: 'sunsetStart' }, async () => {
  if (await config.disable()) {
    return;
  }

  await setStateAsync('scene.0.Shutters.Night', true);
});

log(`Next sunrise: ${getAstroDate('sunrise')}`);
const sunrise = schedule({ astro: 'sunrise' }, async () => {
  if (await config.disable()) {
    return;
  }

  if (await config.sunnyDay()) {
    const afternoon = config.afternoon();

    Notify.mobile(
      `${
        Site.location
      }: Sunny day shutters until ${afternoon.toLocaleString()}`,
    );

    await setStateAsync(config.scenes.sunnyDay, true);

    const afternoonShutters = schedule(
      formatDate(afternoon, 'm h * * *'),
      async () => {
        if (await config.disable()) {
          if (!clearSchedule(afternoonShutters)) {
            log(
              'Error clearing schedule to return shutters to afternoon levels',
              'error',
            );
          }

          return;
        }

        Notify.mobile(
          `${Site.location}: Setting shutters to sunny day afternoon levels`,
        );
        await setStateAsync(config.scenes.sunnyDayAfternoon, true);

        if (!clearSchedule(afternoonShutters)) {
          log(
            'Error clearing schedule to return shutters to afternoon levels',
            'error',
          );
        }
      },
    );
  } else {
    await setStateAsync(config.scenes.day, true);
  }
});

onStop(() => [sunset, sunrise].forEach(scheduled => clearSchedule(scheduled)));
