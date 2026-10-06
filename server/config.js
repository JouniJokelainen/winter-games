import { relative, resolve, sep } from 'node:path';
import { createPublisher } from './publisher.js';

const NO_PUBLISH = { publish: async () => ({ committed: false, pushed: false }) };

// Builds the leaderboard path and publisher from environment variables.
// PUBLISH=0 disables git commits/pushes; LEADERBOARD_PATH overrides docs/leaderboard.json.
export function createServerConfig(env, repoDir) {
  const leaderboardPath = resolve(repoDir, env.LEADERBOARD_PATH ?? 'docs/leaderboard.json');
  const publisher = env.PUBLISH === '0'
    ? NO_PUBLISH
    : createPublisher({ repoDir, filePath: relative(repoDir, leaderboardPath).replaceAll(sep, '/') });
  return { leaderboardPath, publisher };
}
