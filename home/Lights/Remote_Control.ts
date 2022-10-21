const config = {
  brightnessChange: 5,
};

const remotes = [
  new Remotes.TradfriDimmer({
    // Kitchen TRADFRI on/off switch
    device: AdapterId.build(AdapterIds.zigbee, '588e81fffe2bacf4'),
    dim: {
      brightnessChange: config.brightnessChange,
      lights: Remotes.DimmableLights.for(
        ...new Remotes.ObjectsWithStateQuery({
          rooms: 'kitchen',
          functions: 'light',
        }).values(),
      ),
    },
    cycle: {
      off: 'scene.0.Kitchen.Lights',
      on: [
        'scene.0.Kitchen.Lights_Dim',
        'scene.0.Kitchen.Lights_Downlight',
        'scene.0.Kitchen.Lights_Downlight_+_Dining',
        'scene.0.Kitchen.Lights_Downlight_+_Kitchen',
        'scene.0.Kitchen.Lights_Bright',
        'scene.0.Kitchen.Lights_Cozy',
      ],
    },
  }),
  new Remotes.TradfriDimmer({
    // Bedroom TRADFRI on/off switch
    device: AdapterId.build(AdapterIds.zigbee, '588e81fffe17a8ca'),
    dim: {
      brightnessChange: config.brightnessChange,
      lights: Remotes.DimmableLights.for(
        ...new Remotes.ObjectsWithStateQuery({
          rooms: 'bedroom',
          functions: 'light',
        }).values(),
      ),
    },
    cycle: {
      off: () => {
        log('Bedroom: Triggered off');

        const inBed = 'scene.0.Lights.In_Bed';
        if (getState(inBed).val !== true) {
          log(
            'Bedroom: Turn off everything except bathroom lights (if occupied)',
          );
          return inBed;
        }

        log('Bedroom: Turn off everything');
        return 'scene.0.Lights.All_Lights_Off_Including_Smart';
      },
      on: [
        'scene.0.Bedroom.Lights_Cozy',
        'scene.0.Bedroom.Lights_Dim',
        'scene.0.Bedroom.Lights_Bright',
      ],
    },
  }),
  new Remotes.Philips({
    // Hue Remote RWL021
    device: AdapterId.build(AdapterIds.zigbee, '001788010872fbc4'),
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
        'scene.0.Living Room.Lights_TV',
        'scene.0.Living Room.Lights_Reading',
        'scene.0.Living Room.Lights_Bright',
      ],
    },
  }),
  new Remotes.Shelly({
    device: 'mqtt.0.home.office.power.stat.shelly1-4',
    cycle: {
      off: 'scene.0.Office.Lights',
      on: [
        'scene.0.Office.Lights_Cozy',
        'scene.0.Office.Lights_Dim',
        'scene.0.Office.Lights_Bright',
      ],
    },
  }),
  new Remotes.Shelly({
    device: 'mqtt.0.home.utility-room.power.stat.shelly1-1',
    toggle: {
      states: ['scene.0.Utility Room.Entered'],
    },
  }),
  new Remotes.Shelly({
    device: 'mqtt.0.home.bedroom.power.stat.shelly1-2',
    cycle: {
      off: 'scene.0.Bedroom.Lights',
      on: [
        'scene.0.Bedroom.Lights_Bright',
        'scene.0.Bedroom.Lights_Dim',
        'scene.0.Bedroom.Lights_Cozy',
      ],
    },
  }),
  new Remotes.Shelly({
    device: 'mqtt.0.home.hall.power.stat.shelly1-3',
    toggle: {
      off: ['scene.0.Bathroom.Lights'],
      states: ['scene.0.Bathroom.Lights_Bright'],
    },
  }),
  new Remotes.Shelly({
    device: 'mqtt.0.home.hall.power.stat.shelly1-8',
    toggle: { states: ['scene.0.Leaving_Home'] },
  }),
  new Remotes.Shelly({
    device: 'mqtt.0.home.hall.power.stat.shelly1-7',
    toggle: {
      off: ['scene.0.Kitchen.Lights'],
      states: ['scene.0.Kitchen.Lights_Bright'],
    },
  }),
  new Remotes.Shelly({
    device: 'mqtt.0.home.kitchen.power.stat.shelly1-9',
    toggle: {
      off: ['scene.0.Kitchen.Lights'],
      states: ['scene.0.Kitchen.Lights_Bright'],
    },
  }),
  new Remotes.Shelly({
    device: 'mqtt.0.home.living-room.power.stat.shelly1-5',
    toggle: {
      off: ['scene.0.Living Room.Lights'],
      states: ['scene.0.Living Room.Lights_Bright'],
    },
  }),
  new Remotes.Shelly({
    device: 'mqtt.0.home.hall.power.stat.shelly1-6',
    toggle: {
      off: ['scene.0.Hall.Lights'],
      states: ['scene.0.Hall.Lights_Bright'],
    },
  }),
  new Remotes.Shelly({
    device: 'mqtt.0.home.kitchen.power.stat.shelly1-10',
    toggle: {
      off: ['scene.0.Living Room.Lights'],
      states: ['scene.0.Living Room.Lights_Bright'],
    },
  }),
];

const subscriptions = remotes.map(remote => remote.setUp());

onStop(() => {
  subscriptions.forEach(subscription => subscription.unsubscribe());
});
