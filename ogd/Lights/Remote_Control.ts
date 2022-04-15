const config = {
  brightnessChange: 5,
};

const remotes = [
  new Remotes.Aquara({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001af12f'),
    cycle: {
      off: 'scene.0.Bedroom East.Lights',
      on: [
        'scene.0.Bedroom East.Lights_Cozy',
        'scene.0.Bedroom East.Lights_Table_Light_Only',
        'scene.0.Bedroom East.Lights_Bright',
      ],
    },
  }),
  new Remotes.Aquara({
    device: AdapterId.build(AdapterIds.zigbee, '54ef441000123198'),
    cycle: {
      off: 'scene.0.Bedroom West.Lights',
      on: [
        'scene.0.Bedroom West.Lights_Cozy',
        'scene.0.Bedroom West.Lights_Table_Light_Only',
        'scene.0.Bedroom West.Lights_Bright',
      ],
    },
  }),
  new Remotes.Aquara({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001af4b3'),
    dim: {
      brightnessChange: config.brightnessChange,
      lights: Remotes.DimmableLights.for(
        ...new Remotes.ObjectsWithStateQuery({
          rooms: 'staircase',
          functions: 'light',
        }).values(),
      ),
    },
    cycle: {
      off: 'scene.0.Staircase.Lights',
      on: ['scene.0.Staircase.Lights_Cozy', 'scene.0.Staircase.Lights_Bright'],
    },
  }),
  new Remotes.Aquara({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001aea56'),
    cycle: {
      off: 'scene.0.Equipment Room.Lights',
      on: [
        'scene.0.Equipment Room.Lights_Bright',
        'scene.0.Equipment Room.Lights_Cozy',
      ],
    },
  }),
  new Remotes.Philips({
    // Hue Remote RWL021
    device: AdapterId.build(AdapterIds.zigbee, '00178801096ab2d7'),
    dim: {
      brightnessChange: config.brightnessChange,
      lights: Remotes.DimmableLights.for(
        ...new Remotes.ObjectsWithStateQuery({
          rooms: 'living_room',
          functions: 'light',
        }).values(),
      ),
    },
    cycle: {
      off: 'scene.0.Living Room.Lights',
      on: [
        'scene.0.Living Room.Lights_Cozy',
        'scene.0.Living Room.Lights_Bright',
      ],
    },
  }),
];

const subscriptions = remotes.map(remote => remote.setUp());

onStop(() => {
  subscriptions.forEach(subscription => subscription.unsubscribe());
});