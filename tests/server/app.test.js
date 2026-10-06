import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../server/app.js';

async function startApp(t, { publisher } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'wg-app-'));
  const staticDir = join(dir, 'game');
  await mkdir(staticDir);
  await writeFile(join(staticDir, 'index.html'), '<h1>peli</h1>');
  await writeFile(join(dir, 'secret.txt'), 'secret');
  const leaderboardPath = join(dir, 'leaderboard.json');
  const messages = [];
  const app = createApp({
    staticDir,
    leaderboardPath,
    publisher: publisher ?? { publish: async (message) => { messages.push(message); return { committed: true, pushed: true }; } },
    now: () => new Date('2026-10-06T12:00:00.000Z'),
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${server.address().port}`, leaderboardPath, messages };
}

const VALID = {
  nickname: 'jouni',
  events: {
    skiJump: { points: 60, distance: 190 },
    slalom: { points: 30, time: 35.2 },
    luge: { points: 30, time: 35.9 },
  },
};

function post(base, body) {
  return fetch(`${base}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('serves index.html for /', async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(await res.text(), '<h1>peli</h1>');
});

test('returns 404 for missing files and 403 for paths outside the static dir', async (t) => {
  const { base } = await startApp(t);
  assert.equal((await fetch(`${base}/nope.js`)).status, 404);
  // %2f is not normalized by the URL parser, so the server sees and must block "../secret.txt".
  assert.equal((await fetch(`${base}/..%2fsecret.txt`)).status, 403);
});

test('GET /api/leaderboard returns an empty board initially', async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(`${base}/api/leaderboard`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { version: 1, users: {}, recent: [], top: [], eventRecords: {} });
});

test('POST /api/results saves, publishes and returns the user', async (t) => {
  const { base, leaderboardPath, messages } = await startApp(t);
  const res = await post(base, VALID);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.saved, true);
  assert.equal(body.pushed, true);
  assert.equal(body.user.bestTotal, 120);
  assert.deepEqual(messages, ['results: JOUNI 120']);
  const stored = JSON.parse(await readFile(leaderboardPath, 'utf8'));
  assert.equal(stored.recent[0].date, '2026-10-06T12:00:00.000Z');
});

test('POST /api/results rejects invalid payloads without writing', async (t) => {
  const { base, leaderboardPath, messages } = await startApp(t);
  assert.equal((await post(base, { ...VALID, nickname: '' })).status, 400);
  assert.equal((await post(base, '{not json')).status, 400);
  await assert.rejects(readFile(leaderboardPath, 'utf8'), { code: 'ENOENT' });
  assert.deepEqual(messages, []);
});

test('POST /api/results still saves when publishing throws', async (t) => {
  const publisher = { publish: async () => { throw new Error('not a git repo'); } };
  const { base, leaderboardPath } = await startApp(t, { publisher });
  const res = await post(base, VALID);
  assert.equal(res.status, 200);
  assert.deepEqual(
    { saved: true, committed: false, pushed: false },
    (({ saved, committed, pushed }) => ({ saved, committed, pushed }))(await res.json()),
  );
  assert.ok(JSON.parse(await readFile(leaderboardPath, 'utf8')).users.JOUNI);
});
