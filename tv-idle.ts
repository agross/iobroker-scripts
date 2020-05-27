const statesToCheck = [
  'kodi.0.info.playing_time',
  'lgtv.0.states.channelId',
  'lgtv.0.states.currentApp',
  'lgtv.0.states.volume',
];

const whitelistedLgApps = [
  'netflix',
  'amazon',
  'youtube.leanback.v4',
  'ard.mediathek',
  'de.zdf.app.zdfm3',
  'tagesschau',
];

const turnOffAfterIdleMinutes = 20;
const turnOffAfter = turnOffAfterIdleMinutes * 60 * 1000;

const cache = 'tv.turnedOffAt';

createState(cache, undefined, {
  name: 'Timestamp when the TV has been switched off by script',
  type: 'number',
  role: 'date',
});

interface StateWithId {
  id: string;
  state: iobJS.State;
}

let latest: StateWithId = undefined;

// Load initial states, taking newest.
statesToCheck.forEach(stateToCheck => {
  const state = getState(stateToCheck);
  if (state.notExist) {
    log(`${stateToCheck} does not exist`);
    return;
  }

  if (!latest) {
    log(`Assigned initial state ${JSON.stringify(state)}`);
    latest = {
      id: stateToCheck,
      state: state as iobJS.State,
    };

    return;
  }

  if (latest.state.lc < state.lc) {
    log(`Found newer state ${JSON.stringify(state)}`);
    latest = {
      id: stateToCheck,
      state: state as iobJS.State,
    };
  }
});

on({ id: statesToCheck, change: 'ne' }, event => {
  latest = {
    id: event.id,
    state: event.state,
  };
});

// Every minute
on({ time: '*/1 * * * *' }, () => {
  if (!latest) {
    log('No timestamp information', 'debug');
    return;
  }

  log(
    `Picked ${latest.id} ("${latest.state.val}" from ${new Date(
      latest.state.lc,
    ).toLocaleString()}) as source`,
    'debug',
  );

  const lastTurnedOffAt = getState(cache);
  if (lastTurnedOffAt.val && latest.state.lc < lastTurnedOffAt.val) {
    log('TV was turned off after picked event, nothing to do', 'debug');
    return;
  }

  const now = Date.now();

  log(`Checking ${now - latest.state.lc} > ${turnOffAfter}`, 'debug');
  if (now - latest.state.lc > turnOffAfter) {
    const lgApp = getState('lgtv.0.states.currentApp').val;
    if (whitelistedLgApps.indexOf(lgApp) !== -1) {
      log(`Whitelisted app ${lgApp} active`);
      return;
    }

    log(`Timeout, turning off TV`);
    setState(cache, now, true, function (err) {
      if (err) {
        log(err);
      }
    });
    setState('lgtv.0.states.power', false, false);
  }
});
