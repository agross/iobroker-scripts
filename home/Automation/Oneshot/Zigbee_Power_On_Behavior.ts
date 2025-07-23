export {}

await $('state[id=zigbee.*.power_on_behavior](functions=light)').setStateAsync('previous');

stopScript(undefined);
