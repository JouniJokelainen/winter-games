import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyResult, emptyBoard, RECENT_LIMIT, topTotals, validateResult,
} from '../../game/core/leaderboard.js';

function makeResult(nickname, [skiJump, slalom, luge]) {
  return {
    nickname,
    events: {
      skiJump: { points: skiJump[0], distance: skiJump[1] },
      slalom: { points: slalom[0], time: slalom[1] },
      luge: { points: luge[0], time: luge[1] },
    },
  };
}

const DATE = '2026-10-06T12:00:00.000Z';

test('validateResult accepts a well-formed payload and normalizes the nickname', () => {
  const outcome = validateResult(makeResult('jouni', [[60, 190], [30, 35.2], [30, 35.9]]));
  assert.equal(outcome.ok, true);
  assert.equal(outcome.value.nickname, 'JOUNI');
  assert.deepEqual(outcome.value.events.slalom, { points: 30, time: 35.2 });
});

test('validateResult accepts null metrics for failed events', () => {
  assert.equal(validateResult(makeResult('A', [[0, null], [0, null], [0, null]])).ok, true);
});

test('validateResult rejects bad payloads', () => {
  const cases = [
    null,
    'text',
    makeResult('', [[60, 190], [30, 35], [30, 35]]),
    makeResult('A B', [[60, 190], [30, 35], [30, 35]]),
    makeResult('A', [[81, 200], [30, 35], [30, 35]]),
    makeResult('A', [[60, 201], [30, 35], [30, 35]]),
    makeResult('A', [[60, 190], [61, 35], [30, 35]]),
    makeResult('A', [[60, 190], [30, -1], [30, 35]]),
    makeResult('A', [[60, 190], [30, 35], [1.5, 35]]),
    { nickname: 'A' },
  ];
  for (const payload of cases) {
    assert.equal(validateResult(payload).ok, false, JSON.stringify(payload));
  }
});

test('applyResult adds a new user, recent entry, top list and event records', () => {
  const board = applyResult(emptyBoard(), makeResult('JOUNI', [[60, 190], [30, 35.2], [40, 33.1]]), DATE);
  assert.deepEqual(board.users.JOUNI, {
    bestTotal: 130,
    competitions: 1,
    records: {
      skiJump: { points: 60, distance: 190, date: DATE },
      slalom: { points: 30, time: 35.2, date: DATE },
      luge: { points: 40, time: 33.1, date: DATE },
    },
  });
  assert.deepEqual(board.recent[0], { nickname: 'JOUNI', date: DATE, total: 130, events: makeResult('JOUNI', [[60, 190], [30, 35.2], [40, 33.1]]).events });
  assert.deepEqual(board.top, [{ nickname: 'JOUNI', total: 130 }]);
  assert.equal(board.eventRecords.luge.nickname, 'JOUNI');
});

test('applyResult keeps the best total and only improves records', () => {
  let board = applyResult(emptyBoard(), makeResult('JOUNI', [[60, 190], [30, 35.2], [40, 33.1]]), DATE);
  board = applyResult(board, makeResult('JOUNI', [[70, 195], [20, 37.0], [0, null]]), '2026-10-07T12:00:00.000Z');
  const user = board.users.JOUNI;
  assert.equal(user.bestTotal, 130);
  assert.equal(user.competitions, 2);
  assert.equal(user.records.skiJump.distance, 195);
  assert.equal(user.records.slalom.time, 35.2);
  assert.equal(user.records.luge.time, 33.1);
  assert.equal(board.recent.length, 2);
  assert.equal(board.recent[0].total, 90);
});

test('applyResult does not store records for failed events', () => {
  const board = applyResult(emptyBoard(), makeResult('A', [[0, null], [0, null], [0, null]]), DATE);
  assert.deepEqual(board.users.A.records, {});
  assert.deepEqual(board.eventRecords, {});
});

test('applyResult does not mutate the input board', () => {
  const board = applyResult(emptyBoard(), makeResult('A', [[60, 190], [30, 35], [30, 35]]), DATE);
  const snapshot = structuredClone(board);
  applyResult(board, makeResult('B', [[70, 195], [40, 33], [40, 33]]), DATE);
  assert.deepEqual(board, snapshot);
});

test('recent list is capped', () => {
  let board = emptyBoard();
  for (let i = 0; i < RECENT_LIMIT + 5; i++) {
    board = applyResult(board, makeResult('A', [[i % 80, 190], [0, null], [0, null]]), DATE);
  }
  assert.equal(board.recent.length, RECENT_LIMIT);
});

test('topTotals sorts by total then nickname and limits', () => {
  const users = {
    B: { bestTotal: 100, competitions: 1, records: {} },
    A: { bestTotal: 100, competitions: 1, records: {} },
    C: { bestTotal: 150, competitions: 1, records: {} },
  };
  assert.deepEqual(topTotals(users, 2), [{ nickname: 'C', total: 150 }, { nickname: 'A', total: 100 }]);
});

test('eventRecords picks the best record across users', () => {
  let board = applyResult(emptyBoard(), makeResult('A', [[60, 190], [30, 35], [30, 35.5]]), DATE);
  board = applyResult(board, makeResult('B', [[60, 190.5], [20, 36], [30, 35.1]]), DATE);
  assert.equal(board.eventRecords.skiJump.nickname, 'B');
  assert.equal(board.eventRecords.slalom.nickname, 'A');
  assert.equal(board.eventRecords.luge.nickname, 'B');
});
