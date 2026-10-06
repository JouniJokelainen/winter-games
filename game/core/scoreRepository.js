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
