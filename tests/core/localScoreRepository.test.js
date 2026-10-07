import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_BOARD_KEY, LocalScoreRepository } from '../../game/core/localScoreRepository.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

function payload(nickname, skiJump, slalom, luge) {
  return {
    nickname,
    events: {
      skiJump: { points: skiJump, distance: 150 },
      slalom: { points: slalom, time: 34.5 },
      luge: { points: luge, time: 36.2 },
    },
  };
}

const NOW = () => new Date('2026-10-08T10:00:00.000Z');

test('a saved result can be read back and is marked local', async () => {
  const repository = new LocalScoreRepository(fakeStorage(), NOW);
  const response = await repository.saveResult(payload('aku', 40, 30, 20));
  assert.deepEqual(
    { saved: response.saved, local: response.local, committed: response.committed, pushed: response.pushed },
    { saved: true, local: true, committed: false, pushed: false },
  );
  assert.equal(response.user.bestTotal, 90);
  assert.deepEqual(await repository.getNicknames(), ['AKU']);
  assert.equal((await repository.getUser('AKU')).bestTotal, 90);
  assert.equal(await repository.getUser('NOBODY'), null);
  assert.equal((await repository.getLeaderboard()).recent[0].total, 90);
});

test('the best total is kept and every competition is counted', async () => {
  const repository = new LocalScoreRepository(fakeStorage(), NOW);
  await repository.saveResult(payload('AKU', 20, 20, 20));
  await repository.saveResult(payload('AKU', 50, 40, 30));
  await repository.saveResult(payload('AKU', 10, 10, 10));
  const user = await repository.getUser('AKU');
  assert.equal(user.bestTotal, 120);
  assert.equal(user.competitions, 3);
});

test('nicknames are sorted in Finnish alphabetical order', async () => {
  const repository = new LocalScoreRepository(fakeStorage(), NOW);
  for (const name of ['ÖRKKI', 'AKU', 'ÄIJÄ']) await repository.saveResult(payload(name, 10, 10, 10));
  assert.deepEqual(await repository.getNicknames(), ['AKU', 'ÄIJÄ', 'ÖRKKI']);
});

test('results persist across repository instances that share the storage', async () => {
  const storage = fakeStorage();
  await new LocalScoreRepository(storage, NOW).saveResult(payload('AKU', 40, 30, 20));
  assert.ok(storage.data.has(LOCAL_BOARD_KEY));
  assert.deepEqual(await new LocalScoreRepository(storage, NOW).getNicknames(), ['AKU']);
});

test('an invalid payload is rejected with the validation message and stores nothing', async () => {
  const storage = fakeStorage();
  const repository = new LocalScoreRepository(storage, NOW);
  await assert.rejects(repository.saveResult({ nickname: '', events: {} }), /invalid nickname/);
  assert.equal(storage.data.size, 0);
});

test('unparseable stored data starts an empty board that can be saved to', async () => {
  const storage = fakeStorage({ [LOCAL_BOARD_KEY]: '{oops' });
  const repository = new LocalScoreRepository(storage, NOW);
  assert.deepEqual(await repository.getNicknames(), []);
  await repository.saveResult(payload('AKU', 40, 30, 20));
  assert.deepEqual(JSON.parse(storage.data.get(LOCAL_BOARD_KEY)).users.AKU.bestTotal, 90);
});

test('stored data of the wrong shape is treated as an empty board', async () => {
  const storage = fakeStorage({ [LOCAL_BOARD_KEY]: JSON.stringify({ hello: 'world' }) });
  assert.deepEqual(await new LocalScoreRepository(storage, NOW).getNicknames(), []);
});

test('without storage the board is kept in memory for the session', async () => {
  const repository = new LocalScoreRepository(null, NOW);
  await repository.saveResult(payload('AKU', 40, 30, 20));
  assert.deepEqual(await repository.getNicknames(), ['AKU']);
});

test('a storage that refuses writes falls back to memory', async () => {
  const storage = fakeStorage();
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const repository = new LocalScoreRepository(storage, NOW);
  await repository.saveResult(payload('AKU', 40, 30, 20));
  assert.deepEqual(await repository.getNicknames(), ['AKU']);
});
