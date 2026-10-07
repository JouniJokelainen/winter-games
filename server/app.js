import { readFile } from 'node:fs/promises';
import { extname, normalize, resolve, sep } from 'node:path';
import { applyResult, validateResult } from '../game/core/leaderboard.js';
import { loadBoard, saveBoard } from './leaderboardStore.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};
const MAX_BODY_BYTES = 10_000;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME_TYPES['.json'], 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createApp({ staticDir, leaderboardPath, publisher, now = () => new Date() }) {
  const root = resolve(staticDir);
  let writeQueue = Promise.resolve();

  async function handleResult(req, res) {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: 'invalid json' });
      return;
    }
    const validation = validateResult(payload);
    if (!validation.ok) {
      sendJson(res, 400, { error: validation.error });
      return;
    }
    const result = validation.value;

    const job = writeQueue.then(async () => {
      const board = applyResult(await loadBoard(leaderboardPath), result, now().toISOString());
      await saveBoard(leaderboardPath, board);
      return board;
    });
    writeQueue = job.catch(() => {});
    const board = await job;

    let publishStatus = { committed: false, pushed: false };
    try {
      publishStatus = await publisher.publish(`results: ${result.nickname} ${board.recent[0].total}`);
    } catch (err) {
      console.warn(`publish failed: ${err.message}`);
    }
    sendJson(res, 200, { saved: true, ...publishStatus, user: board.users[result.nickname] });
  }

  async function serveStatic(pathname, res) {
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const filePath = resolve(root, normalize(relative));
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      sendJson(res, 403, { error: 'forbidden' });
      return;
    }
    try {
      const data = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      throw err;
    }
  }

  return async function handle(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
        sendJson(res, 200, await loadBoard(leaderboardPath));
      } else if (url.pathname === '/api/results' && req.method === 'POST') {
        await handleResult(req, res);
      } else if (req.method === 'GET') {
        await serveStatic(url.pathname, res);
      } else {
        sendJson(res, 405, { error: 'method not allowed' });
      }
    } catch (err) {
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, { error: 'internal error' });
    }
  };
}
