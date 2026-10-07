import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseScoreRepository, HttpScoreRepository } from '../../game/core/scoreRepository.js';
import { LocalScoreRepository } from '../../game/core/localScoreRepository.js';

function fakeFetch(responses) {
  const calls = [];
  async function fetchFn(url, options = {}) {
    calls.push({ url, options });
    const { status = 200, body } = responses[url];
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }
  return { fetchFn, calls };
}

const BOARD = {
  version: 1,
  users: { ÖRKKI: { bestTotal: 10 }, AKU: { bestTotal: 50 }, ÄIJÄ: { bestTotal: 20 } },
  recent: [],
  top: [],
  eventRecords: {},
};

test('getNicknames returns user names in Finnish alphabetical order', async () => {
  const { fetchFn } = fakeFetch({ '/api/leaderboard': { body: BOARD } });
  const repository = new HttpScoreRepository(fetchFn);
  assert.deepEqual(await repository.getNicknames(), ['AKU', 'ÄIJÄ', 'ÖRKKI']);
});

test('getUser returns the user or null', async () => {
  const { fetchFn } = fakeFetch({ '/api/leaderboard': { body: BOARD } });
  const repository = new HttpScoreRepository(fetchFn);
  assert.deepEqual(await repository.getUser('AKU'), { bestTotal: 50 });
  assert.equal(await repository.getUser('NOBODY'), null);
});

test('saveResult posts JSON and returns the server response', async () => {
  const { fetchFn, calls } = fakeFetch({ '/api/results': { body: { saved: true, pushed: true } } });
  const repository = new HttpScoreRepository(fetchFn);
  const payload = { nickname: 'AKU', events: {} };
  assert.deepEqual(await repository.saveResult(payload), { saved: true, pushed: true });
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
});

test('non-OK responses throw with the server error message', async () => {
  const { fetchFn } = fakeFetch({
    '/api/results': { status: 400, body: { error: 'invalid nickname' } },
    '/api/leaderboard': { status: 500, body: {} },
  });
  const repository = new HttpScoreRepository(fetchFn);
  await assert.rejects(repository.saveResult({}), /invalid nickname/);
  await assert.rejects(repository.getLeaderboard(), /HTTP 500/);
});

test('chooseScoreRepository picks the HTTP repository when the server answers', async () => {
  const { fetchFn, calls } = fakeFetch({ '/api/leaderboard': { body: BOARD } });
  const repository = await chooseScoreRepository({ fetchFn });
  assert.ok(repository instanceof HttpScoreRepository);
  assert.equal(calls.length, 1);
});

test('chooseScoreRepository falls back to the local repository on a 404 (GitHub Pages)', async () => {
  const { fetchFn } = fakeFetch({ '/api/leaderboard': { status: 404, body: {} } });
  const storage = { getItem: () => null, setItem() {} };
  const repository = await chooseScoreRepository({ fetchFn, storage });
  assert.ok(repository instanceof LocalScoreRepository);
  assert.equal(repository.storage, storage);
});

test('chooseScoreRepository falls back to the local repository on a network error', async () => {
  const fetchFn = async () => { throw new TypeError('Failed to fetch'); };
  assert.ok((await chooseScoreRepository({ fetchFn })) instanceof LocalScoreRepository);
});

test('chooseScoreRepository falls back when the response is not JSON', async () => {
  const fetchFn = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } });
  assert.ok((await chooseScoreRepository({ fetchFn })) instanceof LocalScoreRepository);
});

test('chooseScoreRepository falls back when the server does not answer in time', async () => {
  const fetchFn = () => new Promise(() => {});
  assert.ok((await chooseScoreRepository({ fetchFn, timeoutMs: 20 })) instanceof LocalScoreRepository);
});
