import { applyResult, emptyBoard, validateResult } from './leaderboard.js';

// PostgREST returns at most 1000 rows per request; the board is rebuilt from the newest ones.
const ROW_LIMIT = 1000;
const COLUMNS = 'nickname,ski_jump_points,ski_jump_distance,slalom_points,slalom_time,luge_points,luge_time,created_at';

function rowToResult(row) {
  return {
    nickname: row.nickname,
    events: {
      skiJump: { points: row.ski_jump_points, distance: row.ski_jump_distance },
      slalom: { points: row.slalom_points, time: row.slalom_time },
      luge: { points: row.luge_points, time: row.luge_time },
    },
  };
}

// Shared leaderboard in Supabase. Same interface as the other score repositories. The key is the
// project's publishable key: writes only go through the submit_result function, which validates them.
export class SupabaseScoreRepository {
  constructor({ url, key }, fetchFn = (...args) => globalThis.fetch(...args)) {
    this.url = url.replace(/\/+$/, '');
    this.headers = { apikey: key, 'Content-Type': 'application/json' };
    this.fetch = fetchFn;
  }

  async getLeaderboard() {
    const query = `select=${COLUMNS}&order=created_at.desc&limit=${ROW_LIMIT}`;
    const response = await this.fetch(`${this.url}/rest/v1/results?${query}`, { headers: this.headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    return rows.reduceRight(
      (board, row) => applyResult(board, rowToResult(row), row.created_at),
      emptyBoard(),
    );
  }

  async getNicknames() {
    const board = await this.getLeaderboard();
    return Object.keys(board.users).sort((a, b) => a.localeCompare(b, 'fi'));
  }

  async getUser(nickname) {
    const board = await this.getLeaderboard();
    return board.users[nickname] ?? null;
  }

  async saveResult(payload) {
    const validation = validateResult(payload);
    if (!validation.ok) throw new Error(validation.error);
    const response = await this.fetch(`${this.url}/rest/v1/rpc/submit_result`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ p_payload: validation.value }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? `HTTP ${response.status}`);
    }
    const board = await this.getLeaderboard();
    return { saved: true, remote: true, committed: false, pushed: false, user: board.users[validation.value.nickname] };
  }
}
