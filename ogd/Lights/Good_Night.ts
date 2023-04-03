import { filter, tap } from 'rxjs/operators';

const config = {
  east: {
    trigger: 'zigbee.0.54ef4410001c6983.double_right',
    scenes: [
      'scene.0.Staircase.Lights_Cozy',
      'scene.0.Bedroom East.Lights_Cozy',
    ],
  },
  west: {
    trigger: 'zigbee.0.54ef4410001c6983.double_left',
    scenes: [
      'scene.0.Staircase.Lights_Cozy',
      'scene.0.Bedroom West.Lights_Cozy',
    ],
  },
};

const locations = Object.values(config).map(location => {
  return new Stream<boolean>({
    id: location.trigger,
    ack: true,
  }).stream.pipe(
    filter(x => x === true),
    tap(_ => {
      location.scenes.forEach(scene => {
        setState(scene, true);
      });
    }),
  );
});

const subscriptions = locations.map(x => x.subscribe());

onStop(() => {
  subscriptions.forEach(subscription => subscription.unsubscribe());
});
