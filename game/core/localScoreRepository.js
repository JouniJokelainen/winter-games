import { applyResult, emptyBoard, validateResult } from './leaderboard.js';

export const LOCAL_BOARD_KEY = 'winterGames.board';

function isBoard(value) {
  return Boolean(value) && value.version === 1 && typeof value.users === 'object' && value.users !== null
    && Array.isArray(value.recent);
}

// Keeps the leaderboard in the player's own browser (localStorage) when no Node server is available.
// Same interface as HttpScoreRepository. Without usable storage the board lives in memory for the session.
export class LocalScoreRepository {
  constructor(storage = null, now = () => new Date()) {
    this.storage = storage;
    this.now = now;
    this.memoryBoard = null;
  }

  readBoard() {
    if (this.memoryBoard) return this.memoryBoard;
    if (!this.storage) return emptyBoard();
    try {
      const raw = this.storage.getItem(LOCAL_BOARD_KEY);
      if (raw === null) return emptyBoard();
      const board = JSON.parse(raw);
      return isBoard(board) ? board : emptyBoard();
    } catch {
      return emptyBoard();
    }
  }

  writeBoard(board) {
    if (this.storage) {
      try {
        this.storage.setItem(LOCAL_BOARD_KEY, JSON.stringify(board));
        this.memoryBoard = null;
        return;
      } catch {
        // Storage is blocked or full: keep the board in memory instead.
      }
    }
    this.memoryBoard = board;
  }

  async getLeaderboard() {
    return this.readBoard();
  }

  async getNicknames() {
    return Object.keys(this.readBoard().users).sort((a, b) => a.localeCompare(b, 'fi'));
  }

  async getUser(nickname) {
    return this.readBoard().users[nickname] ?? null;
  }

  async saveResult(payload) {
    const validation = validateResult(payload);
    if (!validation.ok) throw new Error(validation.error);
    const result = validation.value;
    const board = applyResult(this.readBoard(), result, this.now().toISOString());
    this.writeBoard(board);
    return { saved: true, local: true, committed: false, pushed: false, user: board.users[result.nickname] };
  }
}
