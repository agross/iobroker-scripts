const config = {
  brightnessChange: 5,
};

const remotes = [
  new Remotes.TradfriDimmer({
    // Mobile Switch 1.
    device: AdapterId.build(AdapterIds.zigbee, '50325ffffe784bdf'),
    dim: {
      brightnessChange: config.brightnessChange,
      lights: Remotes.DimmableLights.for(
        ...new Remotes.ObjectsWithStateQuery({
          rooms: 'equipment_room',
          functions: 'light',
        }).values(),
      ),
    },
    cycle: {
      off: 'scene.0.Equipment Room.Lights',
      on: [
        'scene.0.Equipment Room.Lights_Cozy',
        'scene.0.Equipment Room.Lights_Bright',
      ],
    },
  }),
  new Remotes.AqaraWS_EUK03({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001ce745'),
    toggle: {
      off: ['scene.0.Hall.Lights'],
      states: ['scene.0.Hall.Lights_Bright'],
    },
  }),
  new Remotes.AqaraWRS_R02({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001c6707'),
    cycle: {
      off: 'scene.0.House.Lights',
      on: [
        'scene.0.House.Lights_No_Light_Strips',
        'scene.0.House.Lights_Patio_Only',
        'scene.0.House.Lights_Light_Strips_Only',
        'scene.0.House.Lights_Cozy',
        'scene.0.House.Lights_Bright',
      ],
    },
  }),
  new Remotes.AqaraWRS_R02({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001c6638'),
    cycle: {
      off: 'scene.0.Kitchen.Lights',
      on: ['scene.0.Kitchen.Lights_Cozy', 'scene.0.Kitchen.Lights_Bright'],
    },
  }),
  new Remotes.AqaraWRS_R02({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001c6983'),
    cycle: {
      off: 'scene.0.Staircase.Lights',
      on: ['scene.0.Staircase.Lights_Cozy', 'scene.0.Staircase.Lights_Bright'],
    },
  }),
  new Remotes.AqaraWRS_R02({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001af12f'),
    dim: {
      brightnessChange: config.brightnessChange,
      lights: Remotes.DimmableLights.for(
        ...new Remotes.ObjectsWithStateQuery({
          rooms: 'bedroom_east',
          functions: 'light',
        }).values(),
      ),
    },
    cycle: {
      off: 'scene.0.Bedroom East.Lights',
      on: [
        'scene.0.Bedroom East.Lights_Cozy',
        'scene.0.Bedroom East.Lights_Table_Light_Only',
        'scene.0.Bedroom East.Lights_Bright',
      ],
    },
  }),
  new Remotes.AqaraWRS_R02({
    device: AdapterId.build(AdapterIds.zigbee, '54ef441000123198'),
    dim: {
      brightnessChange: config.brightnessChange,
      lights: Remotes.DimmableLights.for(
        ...new Remotes.ObjectsWithStateQuery({
          rooms: 'bedroom_west',
          functions: 'light',
        }).values(),
      ),
    },
    cycle: {
      off: 'scene.0.Bedroom West.Lights',
      on: [
        'scene.0.Bedroom West.Lights_Cozy',
        'scene.0.Bedroom West.Lights_Table_Light_Only',
        'scene.0.Bedroom West.Lights_Bright',
      ],
    },
  }),
  new Remotes.AqaraWRS_R02({
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
  new Remotes.AqaraWRS_R02({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001c66c6'),
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
        'scene.0.Living Room.Lights_Colorful',
        'scene.0.Living Room.Lights_Bright',
      ],
    },
  }),
  new Remotes.AqaraWRS_R02({
    device: AdapterId.build(AdapterIds.zigbee, '001788010c66ea0c'),
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
        'scene.0.Living Room.Lights_Colorful',
        'scene.0.Living Room.Lights_Bright',
      ],
    },
  }),
  new Remotes.AqaraWRS_R02({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001c84c8'),
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
        'scene.0.Living Room.Lights_Colorful',
        'scene.0.Living Room.Lights_Bright',
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
        'scene.0.Living Room.Lights_Colorful',
        'scene.0.Living Room.Lights_Bright',
      ],
    },
  }),
  new Remotes.AqaraWRS_R02({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001aea56'),
    cycle: {
      off: 'scene.0.Equipment Room.Lights',
      on: [
        'scene.0.Equipment Room.Lights_Bright',
        'scene.0.Equipment Room.Lights_Cozy',
      ],
    },
  }),
  new Remotes.AqaraWRS_R02({
    device: AdapterId.build(AdapterIds.zigbee, '54ef4410001af501'),
    cycle: {
      off: 'scene.0.Bathroom.Lights',
      on: () => {
        const day = [
          'scene.0.Bathroom.Lights_Default',
          'scene.0.Bathroom.Lights_Bright',
        ];

        const dim = [
          'scene.0.Bathroom.Lights_Dim',
          'scene.0.Bathroom.Lights_Bright',
        ];

        const night = [
          'scene.0.Bathroom.Lights_Night',
          'scene.0.Bathroom.Lights_Bright',
        ];

        if (isAstroDay()) {
          log('Bathroom lights default');
          return day;
        } else {
          if (compareTime('23:00', '6:00', 'between')) {
            log('Bathroom lights night');
            return night;
          }

          log('Bathroom lights dim');
          return dim;
        }
      },
    },
  }),
];

const subscriptions = remotes.map(remote => remote.setUp());

onStop(() => {
  subscriptions.forEach(subscription => subscription.unsubscribe());
});
