import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublisher } from '../../server/publisher.js';

function fakeRunner({ failOn = null } = {}) {
  const calls = [];
  async function run(cmd, args, cwd) {
    calls.push([cmd, ...args].join(' ') + ` @${cwd}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (failOn && args[0] === failOn) {
      throw Object.assign(new Error(`${failOn} failed`), { stderr: 'boom' });
    }
    return '';
  }
  return { run, calls };
}

const silentLog = { warn() {} };

test('publish adds, commits only the leaderboard file and pushes', async () => {
  const { run, calls } = fakeRunner();
  const publisher = createPublisher({ repoDir: '/repo', filePath: 'docs/leaderboard.json', run, log: silentLog });
  assert.deepEqual(await publisher.publish('results: A 10'), { committed: true, pushed: true });
  assert.deepEqual(calls, [
    'git add docs/leaderboard.json @/repo',
    'git commit -m results: A 10 -- docs/leaderboard.json @/repo',
    'git push @/repo',
  ]);
});

test('push failure is reported but not thrown', async () => {
  const { run } = fakeRunner({ failOn: 'push' });
  const warnings = [];
  const publisher = createPublisher({ repoDir: '/repo', filePath: 'f.json', run, log: { warn: (m) => warnings.push(m) } });
  assert.deepEqual(await publisher.publish('m'), { committed: true, pushed: false });
  assert.match(warnings[0], /git push failed: boom/);
});

test('commit failure rejects', async () => {
  const { run } = fakeRunner({ failOn: 'commit' });
  const publisher = createPublisher({ repoDir: '/repo', filePath: 'f.json', run, log: silentLog });
  await assert.rejects(publisher.publish('m'), /commit failed/);
});

test('publishes are serialized', async () => {
  const { run, calls } = fakeRunner();
  const publisher = createPublisher({ repoDir: '/r', filePath: 'f.json', run, log: silentLog });
  await Promise.all([publisher.publish('one'), publisher.publish('two')]);
  assert.deepEqual(calls.map((c) => c.split(' ')[1]), ['add', 'commit', 'push', 'add', 'commit', 'push']);
  assert.match(calls[1], /one/);
  assert.match(calls[4], /two/);
});

test('a failed publish does not block the next one', async () => {
  let fail = true;
  const calls = [];
  const run = async (cmd, args) => {
    calls.push(args[0]);
    if (fail && args[0] === 'commit') { fail = false; throw new Error('commit failed'); }
    return '';
  };
  const publisher = createPublisher({ repoDir: '/r', filePath: 'f.json', run, log: silentLog });
  await assert.rejects(publisher.publish('one'));
  assert.deepEqual(await publisher.publish('two'), { committed: true, pushed: true });
});
