import wol from 'wake_on_lan';

wol.wake('00:11:32:6a:cb:35', { address: '172.16.0.255' });

stopScript(undefined);
