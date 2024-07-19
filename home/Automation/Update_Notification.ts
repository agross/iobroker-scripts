import { filter, map, pairwise, startWith, tap } from 'rxjs/operators';

const config = {
  indicator: 'admin.0.info.updatesJson',
  replies: [
    {
      text: '🛠 Update all',
      callback_data: 'update-all-adapters',
      callbackReceived: () => {
        update();
      },
    },
    {
      text: '🛠 ',
      callback_data: 'update-adapter-',
      callbackReceived: (adapter: string) => {
        update(adapter);
      },
    },
  ],
  uploadJavaScriptAdapterState: ['0_userdata.0', 'upload-javascript-adapter'],
};

await ObjectCreator.create(
  {
    [config.uploadJavaScriptAdapterState[1]]: {
      type: 'state',
      common: {
        name: 'The JavaScript adapter needs to upload after updating here',
        type: 'boolean',
        def: false,
        read: true,
        write: true,
        role: 'indicator',
      } as iobJS.StateCommon,
      native: {},
    },
  },
  config.uploadJavaScriptAdapterState[0],
);

function truncateString(string: string, maxLength: number = 1000) {
  const truncated =
    string.length > maxLength
      ? `${string.substring(0, maxLength)}…`
      : `${string}`;

  return truncated.trim();
}

import util from 'util';
import { exec } from 'child_process';
const execAsync = util.promisify(exec);

type ProcessResult = { error: boolean; message: string };

async function runProcess(command: string): Promise<ProcessResult> {
  try {
    const message: string[] = [];

    const { stdout, stderr } = await execAsync(command);

    if (stdout) {
      message.push(
        `\`${command}\` standard output:\n\`\`\`\n${truncateString(
          stdout,
        )}\n\`\`\``,
      );
    }

    if (stderr) {
      message.push(
        `\`${command}\` standard error:\n\`\`\`\n${truncateString(
          stderr,
        )}\n\`\`\``,
      );
    }

    return { error: undefined, message: message.join(`\n`) };
  } catch (error) {
    const message = `\`${command}\` failed:\n\`\`\`\n${truncateString(
      JSON.stringify(error),
    )}\n\`\`\``;

    return { error: error, message: message };
  }
}

async function update(adapter: string = 'all') {
  const messages: ProcessResult[] = [];

  if (adapter === 'javascript' || adapter === 'all')
    await setStateAsync(
      config.uploadJavaScriptAdapterState.join('.'),
      true,
      false,
    );

  const upgrade = await runProcess(`iobroker upgrade ${adapter} --yes`);
  messages.push(upgrade);

  if (!upgrade.error) {
    const upload = await runProcess(`iobroker upload ${adapter}`);
    messages.push(upload);
  }

  Notify.mobile(messages.map(x => x.message).join('\n'), {
    telegram: {
      parse_mode: 'Markdown',
    },
  });
}

const replies = Notify.subscribeToCallbacks()
  .pipe(
    tap(x => log(`Callback: ${JSON.stringify(x)}`)),
    map(received => {
      return {
        match: config.replies.find(reply =>
          received.value.startsWith(reply.callback_data),
        ),
        adapter: received.value.replace(/^update-adapter-/, ''),
      };
    }),
    filter(x => x.match !== undefined),
    tap(x => log(`Callback match: ${JSON.stringify(x)}`)),
    tap(x => x.match.callbackReceived(x.adapter)),
  )
  .subscribe();

const updates = new Stream<string>(config.indicator).stream
  .pipe(
    map(json => JSON.parse(json)),
    startWith({}),
    pairwise(),
    map(([prev, next]) => {
      const prevAsSet = new Set([...Object.keys(prev)]);
      const newUpdates = [...Object.keys(next)].filter(x => !prevAsSet.has(x));

      return {
        adapters: newUpdates.sort(),
        json: next,
      };
    }),
    filter(updates => updates.adapters.length > 0),
    tap(updates => {
      const message = Object.entries<any>(updates.json)
        .map(([k, v]) => `${k} ${v.installedVersion} -> ${v.availableVersion}`)
        .join('\n');

      const replies = updates.adapters.map(adapter => {
        const base = config.replies[config.replies.length - 1];

        return {
          text: `${base.text} ${adapter}`,
          callback_data: `${base.callback_data}${adapter}`,
          callbackReceived: undefined,
        };
      });

      Notify.mobile(`New updates available\n\n\`\`\`\n${message}\n\`\`\``, {
        telegram: {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[config.replies[0]].concat(replies)],
          },
        },
      });
    }),
  )
  .subscribe();

// If during startup we see that config.uploadJavaScriptAdapterState is set,
// upload the adapter's files. If this is the case, we were restarted due to an
// update of the JavaScript adapter.
const upload = await getStateAsync<boolean>(
  config.uploadJavaScriptAdapterState.join('.'),
);
if (!upload.ack && upload.val === true) {
  Notify.mobile(`Uploading JavaScript adapter after update`);

  await update('javascript');

  await setStateAsync(
    config.uploadJavaScriptAdapterState.join('.'),
    false,
    true,
  );
}

onStop(() => [replies, updates].forEach(x => x.unsubscribe()));
