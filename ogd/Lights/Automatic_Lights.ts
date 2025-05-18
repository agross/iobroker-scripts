import {
  Observable,
  Subject,
  Subscription,
  combineLatest,
  merge,
  queueScheduler,
  timer,
} from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  observeOn,
  scan,
  startWith,
  switchMap,
  tap,
  throttleTime,
} from 'rxjs/operators';

type Config = {
  room: string;
  presence: string;
  minimumTimeOn: () => Observable<number>;
  stateInput: Subject<Notification>;
  overriddenBy: string[];
  illumination: string;
  illuminationThreshold: number;
  turnOff: string;
  determineScene: () => string;
};

const configs: Config[] = [
  {
    room: 'Bathroom',
    presence: 'zigbee.0.54ef4410006bca59.occupancy',
    minimumTimeOn: () => timer(2 * 60 * 1000),
    stateInput: new Subject<Notification>(),
    overriddenBy: [
      'scene.0.Bathroom.Lights_Bright',
      '0_userdata.0.long-term-absence',
    ],
    illumination: 'zigbee.0.54ef4410006bca59.illuminance_raw',
    illuminationThreshold: 80,
    turnOff: 'scene.0.Bathroom.Lights',
    determineScene: () => {
      const day = 'scene.0.Bathroom.Lights_Default';
      const dim = 'scene.0.Bathroom.Lights_Dim';
      const night = 'scene.0.Bathroom.Lights_Night';

      if (isAstroDay()) {
        return day;
      }
      if (compareTime('23:00', '6:00', 'between')) {
        return night;
      }

      return dim;
    },
  },
  {
    room: 'Hall',
    presence: 'zigbee.0.54ef441000cca37e.occupancy',
    minimumTimeOn: () => timer(0.5 * 60 * 1000),
    stateInput: new Subject<Notification>(),
    overriddenBy: [
      'scene.0.Hall.Lights_Bright',
      '0_userdata.0.long-term-absence',
    ],
    illumination: 'zigbee.0.54ef441000cca37e.illuminance_raw',
    illuminationThreshold: 40,
    turnOff: 'scene.0.Hall.Lights',
    determineScene: () => {
      const day = 'scene.0.Hall.Lights_Default';
      const dim = 'scene.0.Hall.Lights_Dim';
      const night = 'scene.0.Hall.Lights_Night';

      if (isAstroDay()) {
        return day;
      }
      if (compareTime('23:00', '6:00', 'between')) {
        // If any light is on, use a brighter scene.
        if (getState('scene.0.Lights.All_Lights_Off').val !== true) {
          return dim;
        }

        return night;
      }

      return dim;
    },
  },
];

class Movement {
  constructor(public dueTo: string) {
    this.dueTo = dueTo;
  }
}

class IlluminationBelowThreshold {
  constructor(public illumination: number) {
    this.illumination = illumination;
  }
}

class Timeout {}

class OverrideEnabled {}

class OverrideDisabled {}

type Notification =
  | Movement
  | IlluminationBelowThreshold
  | Timeout
  | OverrideEnabled
  | OverrideDisabled;

interface State {
  next(notification: Notification): State;
}

class Unoccupied implements State {
  constructor(private config: Config) {
    this.config = config;
  }

  next(notification: Notification): State {
    switch (notification.constructor.name) {
      case Movement.name:
        return new OccupiedMonitoring(this.config);

      case OverrideEnabled.name:
        return new Disabled(this.config);
    }

    return this;
  }
}

class OccupiedMonitoring implements State {
  subscription: Subscription;
  restartTimeout = new Subject<boolean>();

  constructor(private config: Config) {
    this.config = config;

    const timeout = this.restartTimeout.pipe(
      startWith(true),
      tap(_ =>
        log(`${config.room}: Starting ${this.constructor.name} timeout`),
      ),
      switchMap(_ =>
        config.minimumTimeOn().pipe(
          tap(_ => log(`${config.room}: ${this.constructor.name} timed out`)),
          tap(_ => this.config.stateInput.next(new Timeout())),
        ),
      ),
    );

    // Query and monitor illumination.
    const belowIlluminationThreshold = new Stream<number>(
      config.illumination,
    ).stream.pipe(
      map(x => {
        return {
          belowThreshold: x <= config.illuminationThreshold,
          illumination: x,
        };
      }),
      tap(x => log(`${config.room}: Illumination ${JSON.stringify(x)}`)),
      filter(x => x.belowThreshold),
      map(x => new IlluminationBelowThreshold(x.illumination)),
      tap(x => config.stateInput.next(x)),
    );

    this.subscription = timeout.subscribe();
    this.subscription.add(belowIlluminationThreshold.subscribe());
  }

  next(notification: Notification): State {
    switch (notification.constructor.name) {
      case Movement.name:
        this.restartTimeout.next(true);

        return this;

      case IlluminationBelowThreshold.name:
        this.subscription.unsubscribe();

        const illumination = (notification as IlluminationBelowThreshold)
          .illumination;

        const scene = this.config.determineScene();
        log(
          `${this.config.room}: Occupied with ${illumination} lx, turning on ${scene}`,
        );
        setState(scene, true);

        return new OccupiedWithLights(this.config);

      case Timeout.name:
        this.subscription.unsubscribe();

        return new Unoccupied(this.config);

      case OverrideEnabled.name:
        this.subscription.unsubscribe();

        return new Disabled(this.config);
    }

    return this;
  }
}

class OccupiedWithLights implements State {
  subscription: Subscription;
  restartTimeout = new Subject<boolean>();

  constructor(private config: Config) {
    this.config = config;

    this.subscription = this.restartTimeout
      .pipe(
        startWith(true),
        tap(_ =>
          log(`${config.room}: Starting ${this.constructor.name} timeout`),
        ),
        switchMap(() =>
          config.minimumTimeOn().pipe(
            tap(_ => log(`${config.room}: ${this.constructor.name} timed out`)),
            tap(_ => this.config.stateInput.next(new Timeout())),
          ),
        ),
      )
      .subscribe();
  }

  next(notification: Notification): State {
    switch (notification.constructor.name) {
      case Movement.name:
        this.restartTimeout.next(true);

        return this;

      case Timeout.name:
        this.subscription.unsubscribe();

        log(`${this.config.room}: Timeout, turning off ${this.config.turnOff}`);
        setState(this.config.turnOff, false);

        return new Unoccupied(this.config);

      case OverrideEnabled.name:
        this.subscription.unsubscribe();

        return new Disabled(this.config);
    }

    return this;
  }
}

class Disabled implements State {
  constructor(private config: Config) {
    this.config = config;
  }

  next(notification: Notification): State {
    switch (notification.constructor.name) {
      case OverrideDisabled.name:
        return new Unoccupied(this.config);
    }

    return this;
  }
}

const subscriptions = configs.map(config => {
  const movement = new Stream<boolean>(config.presence, {
    pipe: obs => obs, // All values, not distinct ones.
  }).stream.pipe(
    filter(x => x === true),
    throttleTime(5000),
    map(_ => new Movement(config.presence)),
  );

  var overrides = config.overriddenBy.map(x => new Stream<boolean>(x).stream);
  const override = combineLatest(overrides).pipe(
    map(x => x.some(val => val === true)),
  );

  const overrideEnabled = override.pipe(
    distinctUntilChanged(),
    filter(x => x === true),
    tap(_ => log(`${config.room}: Override enabled`)),
    map(_ => new OverrideEnabled()),
  );

  const overrideDisabled = override.pipe(
    distinctUntilChanged(),
    filter(x => x !== true),
    tap(_ => log(`${config.room}: Override disabled`)),
    map(_ => new OverrideDisabled()),
  );

  return (
    merge(
      movement,
      config.stateInput,
      overrideEnabled,
      overrideDisabled,
    ) as Observable<Notification>
  )
    .pipe(
      // Ensure immediate stateInput notifications from the "next" state are
      // handled by it, and not the previous state if they were scheduled
      // immediately.
      observeOn(queueScheduler),
      scan((state: State, notification) => {
        const next = state.next(notification);

        log(
          `${config.room}: ${notification.constructor.name} ${JSON.stringify(
            notification,
          )} causing ${state.constructor.name} -> ${next.constructor.name}`,
        );

        return next;
      }, new Unoccupied(config)),
    )
    .subscribe();
});

onStop(() => {
  subscriptions.forEach(x => x.unsubscribe());
});
