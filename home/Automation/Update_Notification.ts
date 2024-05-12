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
};

function truncateString(string: string, maxLength: number = 1000) {
  return string.length > maxLength
    ? `${string.substring(0, maxLength)}…`
    : `${string}`;
}

import util from 'util';
import { exec } from 'child_process';
const execAsync = util.promisify(exec);

async function update(adapter: string = 'all') {
  let message: string;
  try {
    // --yes needs to be the last argument, otherwise all adapters are updated.
    const { stdout, stderr } = await execAsync(
      `iobroker upgrade ${adapter} --yes`,
    );

    message = `Update of \`${adapter}\` successful`;

    if (stdout) {
      message += `\n\nStandard output:\n\`\`\`\n${truncateString(
        stdout,
      )}\n\`\`\``;
    }

    if (stderr) {
      message += `\n\nStandard error:\n\`\`\`\n${truncateString(
        stderr,
      )}\n\`\`\``;
    }

    try {
      await execAsync(`iobroker upload ${adapter}`);
    } catch (error) {
      message += `\nBut \`upload\` failed:\n\`\`\`\n${truncateString(
        JSON.stringify(error),
      )}\n\`\`\``;
    }
  } catch (error) {
    message = `Update of \`${adapter}\` failed:\n\`\`\`\n${truncateString(
      JSON.stringify(error),
    )}\n\`\`\``;
  }

  Notify.mobile(message, {
    telegram: {
      parse_mode: 'Markdown',
    },
  });

  try {
    // --yes needs to be the last argument, otherwise all adapters are updated.
    const { stdout, stderr } = await execAsync(
      `iobroker upgrade ${adapter}x --yes`,
    );

    if (stdout) {
      message += `\n\nStandard output:\n\`\`\`\n${truncateString(
        stdout,
        1500,
      )}\n\`\`\``;
    }

    if (stderr) {
      message += `\n\nStandard error:\n\`\`\`\n${truncateString(
        stderr,
        1500,
      )}\n\`\`\``;
    }
  } catch (error) {
    message = `Update of \`${adapter}\` failed:\n\`\`\`\n${error}\n\`\`\``;
  }
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

onStop(() => [replies, updates].forEach(x => x.unsubscribe()));
