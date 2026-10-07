import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyBoard } from '../../game/core/leaderboard.js';
import { loadBoard, saveBoard } from '../../server/leaderboardStore.js';

async function tempDir(t) {
  const dir = await mkdtemp(join(tmpdir(), 'wg-store-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('loadBoard returns an empty board when the file is missing', async (t) => {
  const dir = await tempDir(t);
  assert.deepEqual(await loadBoard(join(dir, 'missing.json')), emptyBoard());
});

test('saveBoard writes pretty JSON that loadBoard reads back', async (t) => {
  const dir = await tempDir(t);
  const path = join(dir, 'leaderboard.json');
  const board = { ...emptyBoard(), top: [{ nickname: 'A', total: 10 }] };
  await saveBoard(path, board);
  await saveBoard(path, board);
  assert.deepEqual(await loadBoard(path), board);
  const text = await readFile(path, 'utf8');
  assert.ok(text.endsWith('}\n'));
  assert.ok(text.includes('\n  "version": 1'));
});
