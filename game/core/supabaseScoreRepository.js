import { DeviceKeys, formatSecret, generateSecret, isValidSecret, normalizeSecret } from './deviceKeys.js';
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
// A nickname belongs to the device that first saved under it: the device's secret code (see deviceKeys.js)
// is sent with every save, and the same code recovers the nickname on another device.
export class SupabaseScoreRepository {
  constructor({ url, key }, fetchFn = (...args) => globalThis.fetch(...args), { storage = null, keys = new DeviceKeys(storage) } = {}) {
    this.url = url.replace(/\/+$/, '');
    this.headers = { apikey: key, 'Content-Type': 'application/json' };
    this.fetch = fetchFn;
    this.keys = keys;
  }

  async rpc(name, body) {
    const response = await this.fetch(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message ?? `HTTP ${response.status}`);
    }
    return response.json();
  }

  // 'free' (nobody has saved under it), 'mine' (this device owns it) or 'taken' (another device does).
  async checkNickname(nickname) {
    const secret = this.keys.get(nickname) ?? generateSecret();
    return this.rpc('nickname_status', { p_nickname: nickname, p_secret: secret });
  }

  // Takes over a nickname on this device with the recovery code from the device that owns it.
  async recoverNickname(nickname, code) {
    const secret = normalizeSecret(code);
    if (!isValidSecret(secret)) return false;
    if ((await this.rpc('nickname_status', { p_nickname: nickname, p_secret: secret })) !== 'mine') return false;
    this.keys.set(nickname, secret);
    return true;
  }

  getRecoveryCode(nickname) {
    const secret = this.keys.get(nickname);
    return secret ? formatSecret(secret) : null;
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
    const { nickname } = validation.value;
    const { secret, created } = this.keys.getOrCreate(nickname);
    try {
      await this.rpc('submit_result', { p_payload: validation.value, p_secret: secret });
    } catch (error) {
      if (created) this.keys.remove(nickname); // a code generated just now is useless when the nickname is taken
      throw error;
    }
    const board = await this.getLeaderboard();
    return {
      saved: true, remote: true, committed: false, pushed: false, user: board.users[nickname], recoveryCode: formatSecret(secret),
    };
  }
}
