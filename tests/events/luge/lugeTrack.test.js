import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curvatureAt, FINISH_S, RED_LINE_S, TURNS, turnNumber } from '../../../game/events/luge/lugeTrack.js';

test('the track starts straight, has ten turns and ends straight', () => {
  assert.equal(TURNS.length, 10);
  assert.equal(curvatureAt(0), 0);
  assert.equal(curvatureAt(FINISH_S), 0);
  assert.ok(RED_LINE_S > 0 && RED_LINE_S < TURNS[0].at);
});

test('a turn is a trapezoid: ramps in, holds, ramps out', () => {
  const turn = TURNS[0];
  assert.equal(curvatureAt(turn.at), 0);
  assert.ok(curvatureAt(turn.at + 10) > 0 && curvatureAt(turn.at + 10) < turn.k);
  assert.equal(curvatureAt(turn.at + turn.length / 2), turn.k);
  assert.equal(curvatureAt(turn.at + turn.length), 0);
});

test('turnNumber counts the turn being driven or the next one', () => {
  assert.equal(turnNumber(0), 1);
  assert.equal(turnNumber(TURNS[0].at + 10), 1);
  assert.equal(turnNumber(TURNS[0].at + TURNS[0].length + 1), 2);
  assert.equal(turnNumber(TURNS.at(-1).at + TURNS.at(-1).length + 1), 10);
  assert.equal(turnNumber(FINISH_S), 10);
});
