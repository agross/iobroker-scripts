import { concatMap, filter, pairwise, take } from 'rxjs/operators';

const otaCheck = `${AdapterIds.zigbee}.info.ota`;
const otaAvailable = `${AdapterIds.zigbee}.info.ota_available`;

const subscription = new Stream<boolean>(otaCheck).stream
  .pipe(
    pairwise(),
    filter(([checking, finished]) => checking && !finished),
    take(1),
    concatMap(async () => {
      const available = await getStateAsync<string>(otaAvailable);
      if (typeof available.val !== 'string') {
        throw new Error(`${otaAvailable} does not contain a JSON string`);
      }

      const devices: unknown = JSON.parse(available.val);
      if (
        !Array.isArray(devices) ||
        !devices.every(device => typeof device === 'string')
      ) {
        throw new Error(`${otaAvailable} does not contain a device array`);
      }

      if (devices.length === 0) {
        log('No Zigbee OTA updates available');

        return;
      }

      log(
        `Starting Zigbee OTA updates for ${devices.length} device(s): ${JSON.stringify(devices)}`,
      );
      await setStateAsync(otaAvailable, available.val, false);
    }),
  )
  .subscribe({
    complete: () => stopScript(undefined),
    error: error => {
      log(`Zigbee OTA update failed: ${error}`, 'error');
      stopScript(undefined);
    },
  });

onStop(() => subscription.unsubscribe());

log('Checking for Zigbee OTA updates. This will take some time.');
await setStateAsync(otaCheck, true, false);
