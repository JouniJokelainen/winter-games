import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createPublisher } from './publisher.js';

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 8080);

const app = createApp({
  staticDir: join(repoDir, 'game'),
  leaderboardPath: join(repoDir, 'docs', 'leaderboard.json'),
  publisher: createPublisher({ repoDir, filePath: 'docs/leaderboard.json' }),
});

createServer(app).listen(port, '127.0.0.1', () => {
  console.log(`Winter Games running at http://127.0.0.1:${port}`);
});
