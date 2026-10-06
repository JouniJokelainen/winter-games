import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createServerConfig } from './config.js';

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 8080);
const { leaderboardPath, publisher } = createServerConfig(process.env, repoDir);

const app = createApp({
  staticDir: join(repoDir, 'game'),
  leaderboardPath,
  publisher,
});

createServer(app).listen(port, '127.0.0.1', () => {
  console.log(`Winter Games running at http://127.0.0.1:${port}`);
});
