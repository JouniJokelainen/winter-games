import { readFile, rename, writeFile } from 'node:fs/promises';
import { emptyBoard } from '../game/core/leaderboard.js';

export async function loadBoard(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return emptyBoard();
    throw err;
  }
}

export async function saveBoard(path, board) {
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(board, null, 2)}\n`, 'utf8');
  await rename(tempPath, path);
}
