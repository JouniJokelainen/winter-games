import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createServerConfig } from '../../server/config.js';

const repoDir = join(process.cwd(), 'repo');

test('defaults to docs/leaderboard.json with a real publisher', () => {
  const { leaderboardPath, publisher } = createServerConfig({}, repoDir);
  assert.equal(leaderboardPath, join(repoDir, 'docs', 'leaderboard.json'));
  assert.equal(typeof publisher.publish, 'function');
});

test('LEADERBOARD_PATH is resolved against the repo dir', () => {
  const { leaderboardPath } = createServerConfig({ LEADERBOARD_PATH: 'docs/leaderboard.dev.json' }, repoDir);
  assert.equal(leaderboardPath, join(repoDir, 'docs', 'leaderboard.dev.json'));
});

test('PUBLISH=0 gives a no-op publisher', async () => {
  const { publisher } = createServerConfig({ PUBLISH: '0' }, repoDir);
  assert.deepEqual(await publisher.publish('AKU'), { committed: false, pushed: false });
});
