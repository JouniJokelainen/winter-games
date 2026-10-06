// Dev mode: results go to an untracked file and are never committed or pushed.
process.env.PUBLISH ??= '0';
process.env.LEADERBOARD_PATH ??= 'docs/leaderboard.dev.json';
await import('./server.js');
