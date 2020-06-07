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

function minutes(val: number) {
  return val * 60 * 1000;
}
const turnOffAfter = minutes(20);
const popups = [10, 5, 1].map(x => {
  return { message: x, from: minutes(x), to: minutes(x - 1) };
});

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

function calculateTimeLeft(latest: number, turnOffAfter: number) {
  const now = Date.now();
  const idleFor = now - latest;
  const timeLeft = turnOffAfter - idleFor;

  return { timeLeft, idleFor, now };
}

function popup(timeLeft: number) {
  const popup = popups.find(x => timeLeft <= x.from && timeLeft >= x.to);

  if (!popup) {
    return;
  }

  let minutes = 'minutes';
  if (popup.message === 1) {
    minutes = 'minute';
  }

  setState('lgtv.0.states.popup', `Turning off in ${popup.message} ${minutes}`);
}

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

  const lgApp = getState('lgtv.0.states.currentApp').val;
  if (whitelistedLgApps.indexOf(lgApp) !== -1) {
    log(`Whitelisted app ${lgApp} active`);
    return;
  }

  const { timeLeft, now } = calculateTimeLeft(latest.state.lc, turnOffAfter);

  popup(timeLeft);
  if (timeLeft < 0) {
    log(`Timeout, turning off TV`);
    setState(cache, now, true, function (err) {
      if (err) {
        log(err);
      }
    });
    setState('lgtv.0.states.power', false, false);
  }
});
