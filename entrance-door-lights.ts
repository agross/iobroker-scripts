const sensor = 'zigbee.0.00158d00045bedc5.opened'; // Entrance Door Contact
const scene = 'scene.0.Late_Night_Entry';

function atNight() {
  return compareTime(
    getAstroDate('sunrise', undefined, 0),
    getAstroDate('sunsetStart', undefined, 0),
    'not between',
  );
}

function getStateCandidates(...candidates: string[]): string {
  return candidates.find(candidate => existsState(candidate));
}

function anyLightsOn() {
  const functions = getEnums('functions') as any[];
  const lights = functions
    .filter(fun => fun.id === 'enum.functions.funcLight')
    .map(lights => lights.members as string[])
    .reduce((acc, el) => (acc.push(...el), acc), []);

  return lights.some(light => {
    const match = getStateCandidates(light, light + '.state');
    if (match === undefined) {
      log(`No state for ${light}`);
      return false;
    }

    const state = getState(match);

    log(`Checking light ${match}: ${state.val}`);

    return state.val ? state.val === true : false;
  });
}

on({ id: sensor, val: true, ack: true }, event => {
  if (!atNight()) {
    log('Daytime, skipping');
    return;
  }

  if (anyLightsOn()) {
    log('Some lights are on, skipping');
    return;
  }

  setState(scene, event.state.val);
});
