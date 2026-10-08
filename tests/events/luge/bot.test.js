import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLugeState, stepLuge } from '../../../game/events/luge/lugeSim.js';
import { lugePoints } from '../../../game/core/scoring.js';
import { BOTS, botControls, runBot } from '../../helpers/lugeBot.js';

const DT = 1 / 60;

test('a good line finishes in about 30 s and earns full points', () => {
  const state = runBot(BOTS.good);
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 28.5 && state.time < 30.5, `good took ${state.time}`);
  assert.ok(lugePoints(state.time) >= 55);
});

test('staying on the centre line is clearly slower than the outer line', () => {
  const good = runBot(BOTS.good);
  const centre = runBot(BOTS.centre);
  assert.equal(centre.phase, 'finished');
  assert.ok(centre.time > 30.5 && centre.time < 33, `centre took ${centre.time}`);
  assert.ok(centre.time - good.time > 1.5);
});

test('an average line is slower still but finishes', () => {
  const state = runBot(BOTS.average);
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 33 && state.time < 36.5, `average took ${state.time}`);
});

test('braking alone, without steering, never finishes the track', () => {
  for (let limit = 20; limit <= 48; limit += 4) {
    const state = createLugeState();
    for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
      const braking = state.phase === 'running' && state.v > limit;
      stepLuge(state, { left: false, right: false, down: braking, pushes: tick % 7 === 0 ? 1 : 0 }, DT);
    }
    assert.equal(state.phase, 'crashed', `braking above ${limit} m/s finished in ${state.time}`);
  }
});

test('holding the brake for the whole run times out', () => {
  const state = createLugeState();
  for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
    stepLuge(state, { left: false, right: false, down: state.phase === 'running', pushes: tick % 7 === 0 ? 1 : 0 }, DT);
  }
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'time');
});

test('driving without any input slides over the rim in a turn', () => {
  const state = createLugeState();
  for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
    stepLuge(state, { left: false, right: false, down: false, pushes: tick % 7 === 0 ? 1 : 0 }, DT);
  }
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'wall');
});

test('steering well but never braking slides over the rim at the tightest turn', () => {
  const state = createLugeState();
  for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
    const controls = botControls(state, { ...BOTS.good, margin: 99 }, tick);
    stepLuge(state, controls, DT);
  }
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'wall');
});

test('holding a steering key crashes into the rim', () => {
  const state = createLugeState();
  for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
    stepLuge(state, { left: false, right: state.phase === 'running', down: false, pushes: tick % 7 === 0 ? 1 : 0 }, DT);
  }
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'wall');
});

test('a careless player with a wide steering tolerance and a short look-ahead still finishes', () => {
  const state = runBot(BOTS.careless);
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 30 && state.time < 34, `careless took ${state.time}`);
});

test('tapping faster saves time and tapping slowly costs time, with the same driving line', () => {
  const good = runBot(BOTS.good);
  const fast = runBot(BOTS.fast);
  const lazy = runBot(BOTS.lazy);
  assert.equal(fast.phase, 'finished');
  assert.equal(lazy.phase, 'finished');
  assert.ok(good.time - fast.time > 0.8, `fast ${fast.time} vs good ${good.time}`);
  assert.ok(lazy.time - good.time > 3, `lazy ${lazy.time} vs good ${good.time}`);
});

test('a bot that follows the marked racing line finishes in about 29 s with a safe margin to the rim', () => {
  const state = createLugeState();
  let widest = 0;
  for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
    stepLuge(state, botControls(state, BOTS.line, tick), DT);
    if (state.phase === 'running') widest = Math.max(widest, Math.abs(state.lateral));
  }
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 28 && state.time < 30.5, `line took ${state.time}`);
  assert.ok(widest < 0.75, `widest lateral ${widest}`);
});
