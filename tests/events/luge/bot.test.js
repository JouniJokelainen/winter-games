import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLugeState, stepLuge } from '../../../game/events/luge/lugeSim.js';
import { lugePoints } from '../../../game/core/scoring.js';
import { BOTS, runBot } from '../../helpers/lugeBot.js';

const DT = 1 / 60;

test('a good line finishes in about 30 s and earns near-full points', () => {
  const state = runBot(BOTS.good);
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 28.5 && state.time < 30.5, `good took ${state.time}`);
  assert.ok(lugePoints(state.time) >= 55);
});

test('an average line is clearly slower but still finishes', () => {
  const state = runBot(BOTS.average);
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 32 && state.time < 37, `average took ${state.time}`);
});

test('driving without any input crashes in a turn', () => {
  const state = createLugeState();
  for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
    stepLuge(state, { left: false, right: false, down: false, pushes: tick % 7 === 0 ? 1 : 0 }, DT);
  }
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'speed');
});

test('holding a steering key crashes into the rim', () => {
  const state = createLugeState();
  for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
    stepLuge(state, { left: false, right: state.phase === 'running', down: false, pushes: tick % 7 === 0 ? 1 : 0 }, DT);
  }
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'wall');
});
