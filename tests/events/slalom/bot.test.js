import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slalomPoints } from '../../../game/core/scoring.js';
import { COURSE } from '../../../game/events/slalom/course.js';
import { createSlalomState, stepSlalom } from '../../../game/events/slalom/slalomSim.js';
import { BOTS, runBot } from '../../helpers/slalomBot.js';

test('an excellent run takes about 30 seconds with no hits or missed poles', () => {
  const state = runBot(COURSE, BOTS.excellent);
  assert.equal(state.phase, 'finished');
  assert.equal(state.hits, 0);
  assert.equal(state.missed, 0);
  assert.ok(state.time >= 28 && state.time <= 31, `time ${state.time}`);
  assert.ok(slalomPoints(state) >= 55);
});

test('an average run takes 33-36 seconds', () => {
  const state = runBot(COURSE, BOTS.average);
  assert.equal(state.phase, 'finished');
  assert.ok(state.time >= 33 && state.time <= 36, `time ${state.time}`);
});

test('too much speed makes poles impossible to round', () => {
  const state = runBot(COURSE, BOTS.reckless);
  assert.equal(state.phase, 'disqualified', `${state.phase} missed ${state.missed}`);
});

test('a straight run without steering is disqualified for missed poles', () => {
  const state = createSlalomState(COURSE);
  for (let tick = 0; tick < 60 * 60 && (state.phase === 'ready' || state.phase === 'running'); tick++) {
    stepSlalom(state, { left: false, right: false, pushes: tick % 10 === 0 ? 1 : 0 }, 1 / 60);
  }
  assert.equal(state.phase, 'disqualified');
  assert.equal(state.reason, 'missedPoles');
});
