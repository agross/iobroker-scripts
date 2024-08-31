import wol from 'wake_on_lan';

wol.wake('30:9c:23:65:8a:b1', { address: '172.16.0.255' });

stopScript(undefined);
