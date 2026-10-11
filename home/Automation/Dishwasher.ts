import { Subscription, timer } from 'rxjs';
import { scan } from 'rxjs/operators';
import { Temporal } from 'temporal-polyfill';

const config = {
  powerMonitor: 'alias.0.mqtt.0.home.kitchen.power.nous-a1t-3.power',
  powerState: 'alias.0.mqtt.0.home.kitchen.power.nous-a1t-3.state',
  repowerDelay: Temporal.Duration.from({ seconds: 30 }),
  workingThreshold: 50,
  heatingThreshold: 1000,
  minimumHeatingPeriods: 2,
  finishedThreshold: 20,
  finishedDuration: Temporal.Duration.from({ minutes: 1 }),
  // Reports normally arrive every ten seconds. A gap must not count as idle time.
  maximumMeasurementGap: Temporal.Duration.from({ seconds: 60 }),
};

type Cycle = {
  working: boolean;
  heating?: boolean;
  heatingPeriods?: number;
  belowThresholdSince?: Temporal.Instant;
  lastMeasurement?: Temporal.Instant;
};

let repower: Subscription | undefined;

function restorePower() {
  setState(config.powerState, true, false, err => {
    if (err) {
      log(`Could not restore dishwasher power: ${err}`, 'error');
    }
  });
}

function cyclePower() {
  repower?.unsubscribe();
  repower = timer(config.repowerDelay.total('milliseconds')).subscribe(() => {
    restorePower();
    repower = undefined;
  });

  setState(config.powerState, false, false, err => {
    if (err) {
      log(`Could not cut dishwasher power: ${err}`, 'error');
    }
  });
}

function nextCycle(
  cycle: Cycle,
  powerUsage: unknown,
  now: Temporal.Instant,
): Cycle {
  if (
    typeof powerUsage !== 'number' ||
    !Number.isFinite(powerUsage) ||
    powerUsage < 0
  ) {
    return {
      ...cycle,
      belowThresholdSince: undefined,
      lastMeasurement: undefined,
    };
  }

  if (!cycle.working) {
    if (powerUsage <= config.workingThreshold) {
      return cycle;
    }

    log(`Dishwasher started at ${powerUsage} W`);
    cycle = { working: true };
  }

  // Count rising edges, not individual readings within a heating period.
  const heating = powerUsage > config.heatingThreshold;
  const heatingPeriods =
    (cycle.heatingPeriods ?? 0) + (heating && !cycle.heating ? 1 : 0);
  const working: Cycle = {
    working: true,
    heating,
    heatingPeriods,
    lastMeasurement: now,
  };

  if (
    heatingPeriods < config.minimumHeatingPeriods ||
    powerUsage >= config.finishedThreshold
  ) {
    return working;
  }

  const continuous =
    cycle.lastMeasurement !== undefined &&
    Temporal.Instant.compare(now, cycle.lastMeasurement) >= 0 &&
    Temporal.Instant.compare(
      now,
      cycle.lastMeasurement.add(config.maximumMeasurementGap),
    ) <= 0;
  const belowThresholdSince = continuous
    ? (cycle.belowThresholdSince ?? now)
    : now;

  if (
    Temporal.Instant.compare(
      now,
      belowThresholdSince.add(config.finishedDuration),
    ) >= 0
  ) {
    log(`Dishwasher finished at ${powerUsage} W`);
    cyclePower();
    Notify.mobile('Dishwasher has finished');
    return { working: false };
  }

  return { ...working, belowThresholdSince };
}

const monitor = new Stream<number>(config.powerMonitor, {
  map: event => event.state.val,
  pipe: obs => obs, // Repeated equal readings confirm sustained low power.
}).stream
  .pipe(
    scan(
      (cycle: Cycle, powerUsage) =>
        nextCycle(cycle, powerUsage, Temporal.Now.instant()),
      { working: false },
    ),
  )
  .subscribe();

onStop(() => {
  monitor.unsubscribe();

  if (repower) {
    repower.unsubscribe();
    restorePower();
    repower = undefined;
  }
});
