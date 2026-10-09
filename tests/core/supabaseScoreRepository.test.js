import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseScoreRepository, HttpScoreRepository, loadRemoteConfig } from '../../game/core/scoreRepository.js';
import { LocalScoreRepository } from '../../game/core/localScoreRepository.js';
import { SupabaseScoreRepository } from '../../game/core/supabaseScoreRepository.js';

const CONFIG = { url: 'https://example.supabase.co/', key: 'sb_publishable_test' };

function row(nickname, [sj, sl, lu], created_at, times = {}) {
  return {
    nickname,
    ski_jump_points: sj, ski_jump_distance: times.distance ?? 100,
    slalom_points: sl, slalom_time: times.slalom ?? 32,
    luge_points: lu, luge_time: times.luge ?? 33,
    created_at,
  };
}

// Newest first, as the REST query returns them.
const ROWS = [
  row('AKU', [60, 40, 30], '2026-10-09T10:00:00Z'),
  row('BEA', [50, 30, 20], '2026-10-08T10:00:00Z'),
  row('AKU', [40, 20, 10], '2026-10-07T10:00:00Z', { distance: 120 }),
];

function fakeFetch(handler) {
  const calls = [];
  const fetchFn = async (url, options = {}) => {
    calls.push({ url, options });
    const { status = 200, body } = handler(url, options);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetchFn, calls };
}

test('getLeaderboard rebuilds the board from the result rows, oldest first', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: ROWS }));
  const board = await new SupabaseScoreRepository(CONFIG, fetchFn).getLeaderboard();
  assert.match(calls[0].url, /^https:\/\/example\.supabase\.co\/rest\/v1\/results\?select=.*order=created_at\.desc/);
  assert.equal(calls[0].options.headers.apikey, CONFIG.key);
  assert.equal(board.users.AKU.competitions, 2);
  assert.equal(board.users.AKU.bestTotal, 130);
  assert.equal(board.users.AKU.records.skiJump.distance, 100);
  assert.deepEqual(board.recent.map((entry) => entry.nickname), ['AKU', 'BEA', 'AKU']);
  assert.equal(board.recent[0].date, '2026-10-09T10:00:00Z');
  assert.deepEqual(board.top.map((entry) => entry.nickname), ['AKU', 'BEA']);
});

test('getNicknames and getUser read from the rebuilt board', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: ROWS }));
  const repository = new SupabaseScoreRepository(CONFIG, fetchFn);
  assert.deepEqual(await repository.getNicknames(), ['AKU', 'BEA']);
  assert.equal((await repository.getUser('BEA')).bestTotal, 100);
  assert.equal(await repository.getUser('NOBODY'), null);
});

test('saveResult sends the validated result to submit_result and returns the user', async () => {
  const { fetchFn, calls } = fakeFetch((url) => (url.includes('/rpc/') ? { body: { saved: true } } : { body: ROWS }));
  const payload = {
    nickname: ' aku ',
    events: { skiJump: { points: 60, distance: 100 }, slalom: { points: 40, time: 32 }, luge: { points: 30, time: 33 } },
  };
  const saved = await new SupabaseScoreRepository(CONFIG, fetchFn).saveResult(payload);
  const post = calls.find((call) => call.url.endsWith('/rpc/submit_result'));
  assert.equal(post.options.method, 'POST');
  assert.equal(JSON.parse(post.options.body).p_payload.nickname, 'AKU');
  assert.equal(saved.saved, true);
  assert.equal(saved.user.bestTotal, 130);
});

test('saveResult rejects invalid payloads without calling the server, and surfaces server errors', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ status: 400, body: { message: 'rate limit' } }));
  const repository = new SupabaseScoreRepository(CONFIG, fetchFn);
  await assert.rejects(repository.saveResult({ nickname: '', events: {} }), /invalid nickname/);
  assert.equal(calls.length, 0);
  const good = {
    nickname: 'AKU',
    events: { skiJump: { points: 1, distance: 1 }, slalom: { points: 1, time: 1 }, luge: { points: 1, time: 1 } },
  };
  await assert.rejects(repository.saveResult(good), /rate limit/);
  await assert.rejects(repository.getLeaderboard(), /HTTP 400/);
});

test('chooseScoreRepository prefers the Node server, then Supabase, then the browser', async () => {
  const nodeUp = fakeFetch(() => ({ body: { version: 1, users: {}, recent: [] } }));
  assert.ok((await chooseScoreRepository({ fetchFn: nodeUp.fetchFn, remote: CONFIG })) instanceof HttpScoreRepository);

  const pages = fakeFetch((url) => (url.startsWith('/api/') ? { status: 404, body: {} } : { body: ROWS }));
  assert.ok((await chooseScoreRepository({ fetchFn: pages.fetchFn, remote: CONFIG })) instanceof SupabaseScoreRepository);
  assert.ok((await chooseScoreRepository({ fetchFn: pages.fetchFn })) instanceof LocalScoreRepository);

  const allDown = fakeFetch(() => ({ status: 503, body: {} }));
  assert.ok((await chooseScoreRepository({ fetchFn: allDown.fetchFn, remote: CONFIG })) instanceof LocalScoreRepository);
});

test('loadRemoteConfig returns the settings, or null when missing or malformed', async () => {
  assert.deepEqual(await loadRemoteConfig(fakeFetch(() => ({ body: CONFIG })).fetchFn), CONFIG);
  assert.equal(await loadRemoteConfig(fakeFetch(() => ({ status: 404, body: {} })).fetchFn), null);
  assert.equal(await loadRemoteConfig(fakeFetch(() => ({ body: { url: 1 } })).fetchFn), null);
  assert.equal(await loadRemoteConfig(async () => { throw new TypeError('offline'); }), null);
});
