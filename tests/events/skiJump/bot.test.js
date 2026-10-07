import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../../game/engine/rng.js';
import { HILL } from '../../../game/events/skiJump/hill.js';
import { BOTS, runBot } from '../../helpers/skiJumpBot.js';

const SEEDS = [1, 2, 3];

function jump(profile, wind, seed = 1) {
  return runBot(HILL, profile, { wind, rng: createRng(seed) });
}

test('a perfect jump in strong tailwind reaches 199-200 m', () => {
  for (const seed of SEEDS) {
    const state = jump(BOTS.perfect, 4, seed);
    assert.equal(state.landing, 'perfect');
    assert.ok(state.distance >= 199 && state.distance <= 200, `distance ${state.distance}`);
  }
});

test('a perfect jump in calm reaches 188-191 m', () => {
  const state = jump(BOTS.perfect, 0);
  assert.equal(state.landing, 'perfect');
  assert.ok(state.distance >= 188 && state.distance <= 191, `distance ${state.distance}`);
});

test('perfect distance grows with wind', () => {
  let previous = 0;
  for (const wind of [0, 1, 2, 3, 4]) {
    const { distance } = jump(BOTS.perfect, wind);
    assert.ok(distance >= previous, `wind ${wind}: ${distance} < ${previous}`);
    previous = distance;
  }
});

test('an average jump in calm lands at 165-180 m', () => {
  const state = jump(BOTS.average, 0);
  assert.equal(state.phase, 'landed');
  assert.ok(state.distance >= 165 && state.distance <= 180, `distance ${state.distance}`);
});

test('a late takeoff always ends in a fall', () => {
  for (const wind of [0, 2, 4]) assert.equal(jump(BOTS.late, wind).landing, 'fall');
});
