import { LocalScoreRepository } from './localScoreRepository.js';
import { SupabaseScoreRepository } from './supabaseScoreRepository.js';

export class HttpScoreRepository {
  constructor(fetchFn = (...args) => globalThis.fetch(...args)) {
    this.fetch = fetchFn;
  }

  async getLeaderboard() {
    const response = await this.fetch('/api/leaderboard');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
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
    const response = await this.fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
    return body;
  }
}

// Reads the shared-board settings that the Pages build writes next to the game; null when absent (local play).
export async function loadRemoteConfig(fetchFn = (...args) => globalThis.fetch(...args), path = 'supabase-config.json') {
  try {
    const response = await fetchFn(path, { cache: 'no-store' });
    if (!response.ok) return null;
    const config = await response.json();
    return typeof config?.url === 'string' && typeof config?.key === 'string' ? config : null;
  } catch {
    return null;
  }
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Picks where results go, once at start-up so it never changes during a session: the Node server
// when it answers, else the shared Supabase board when configured and reachable, else the player's
// own browser.
export async function chooseScoreRepository({
  fetchFn = (...args) => globalThis.fetch(...args),
  storage = null,
  timeoutMs = 2000,
  remote = null,
} = {}) {
  const http = new HttpScoreRepository(fetchFn);
  try {
    await withTimeout(http.getLeaderboard(), timeoutMs);
    return http;
  } catch {
    // No Node server here (GitHub Pages, server not running).
  }
  if (remote) {
    const shared = new SupabaseScoreRepository(remote, fetchFn);
    try {
      await withTimeout(shared.getLeaderboard(), timeoutMs);
      return shared;
    } catch {
      // The shared board is unreachable: keep results in the browser.
    }
  }
  return new LocalScoreRepository(storage);
}
