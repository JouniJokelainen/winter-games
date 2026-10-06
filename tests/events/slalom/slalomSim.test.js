import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSlalomState, SLALOM_CONFIG, stepSlalom } from '../../../game/events/slalom/slalomSim.js';

const DT = 1 / 60;
const NONE = { left: false, right: false, pushes: 0 };
const TINY_COURSE = {
  startX: 160,
  startY: 0,
  fenceLeftX: 60,
  fenceRightX: 260,
  poles: [
    { x: 140, y: 100, side: 'left', color: 'red' },
    { x: 180, y: 200, side: 'right', color: 'blue' },
  ],
  finishY: 300,
};

function running(overrides = {}) {
  return Object.assign(createSlalomState(TINY_COURSE), { phase: 'running', speed: 60 }, overrides);
}

function stepUntil(state, controls, predicate, maxTicks = 600) {
  for (let i = 0; i < maxTicks && !predicate(state); i++) stepSlalom(state, controls, DT);
  return state;
}

test('stays ready until the first push, then starts with start speed', () => {
  const state = createSlalomState(TINY_COURSE);
  stepSlalom(state, NONE, DT);
  assert.equal(state.phase, 'ready');
  assert.equal(state.y, 0);
  stepSlalom(state, { ...NONE, pushes: 1 }, DT);
  assert.equal(state.phase, 'running');
  assert.equal(state.speed, SLALOM_CONFIG.startSpeed);
  assert.deepEqual(state.events, [{ type: 'start' }]);
});

test('pushes accelerate up to the speed cap', () => {
  const state = running({ speed: 100 });
  stepSlalom(state, { ...NONE, pushes: 1 }, DT);
  const afterOne = state.speed;
  assert.ok(afterOne > 100 + SLALOM_CONFIG.pushImpulse - 2);
  stepSlalom(state, { ...NONE, pushes: 50 }, DT);
  assert.equal(state.speed, SLALOM_CONFIG.maxSpeed);
});

test('without pushes speed settles near the gravity-only limit', () => {
  const state = running({ speed: 200, poles: [], course: { ...TINY_COURSE, poles: [], finishY: 1e9 } });
  for (let i = 0; i < 60 * 20; i++) stepSlalom(state, NONE, DT);
  const limit = Math.sqrt(SLALOM_CONFIG.gravity / SLALOM_CONFIG.drag);
  assert.ok(Math.abs(state.speed - limit) < 2, `speed ${state.speed}`);
});

test('steering right turns right and costs speed', () => {
  const straight = running({ speed: 150 });
  const turning = running({ speed: 150 });
  for (let i = 0; i < 20; i++) {
    stepSlalom(straight, NONE, DT);
    stepSlalom(turning, { ...NONE, right: true }, DT);
  }
  assert.ok(turning.angle > 0.3);
  assert.ok(turning.x > straight.x);
  assert.ok(turning.speed < straight.speed);
});

test('turning is half as fast at top speed and angle is clamped', () => {
  const slow = running({ speed: 0 });
  const fast = running({ speed: SLALOM_CONFIG.maxSpeed });
  stepSlalom(slow, { ...NONE, right: true }, DT);
  stepSlalom(fast, { ...NONE, right: true }, DT);
  assert.ok(Math.abs(fast.angle / slow.angle - (1 - SLALOM_CONFIG.turnSpeedPenalty)) < 0.02);
  const clamped = running({ speed: 0 });
  for (let i = 0; i < 120; i++) stepSlalom(clamped, { ...NONE, left: true }, DT);
  assert.equal(clamped.angle, -SLALOM_CONFIG.maxAngle);
});

test('angle returns toward straight when no arrow is held', () => {
  const state = running({ angle: 0.5 });
  stepSlalom(state, NONE, DT);
  assert.ok(Math.abs(state.angle - (0.5 - SLALOM_CONFIG.returnRate * DT)) < 1e-9);
  for (let i = 0; i < 60; i++) stepSlalom(state, NONE, DT);
  assert.equal(state.angle, 0);
});

test('passing a pole on its outer side counts as passed', () => {
  const state = running({ x: 120, y: 95 });
  stepUntil(state, NONE, (s) => s.nextPole > 0);
  assert.equal(state.poles[0].result, 'passed');
  assert.equal(state.missed, 0);
  assert.equal(state.phase, 'running');
});

test('passing on the wrong side counts as missed but the run continues', () => {
  const state = running({ x: 150, y: 95 });
  stepUntil(state, NONE, (s) => s.nextPole > 0);
  assert.equal(state.poles[0].result, 'missed');
  assert.equal(state.missed, 1);
  assert.equal(state.phase, 'running');
});

test('the pole side is judged where the path crosses the pole line, not after the step', () => {
  const state = running({ x: 139.5, y: 99.8, angle: 1, speed: 60 });
  stepSlalom(state, NONE, DT);
  assert.ok(state.x > 140, `post-step x ${state.x}`);
  assert.equal(state.poles[0].result, 'passed');
  assert.equal(state.missed, 0);
});

test('a second missed pole disqualifies immediately', () => {
  const state = running({ x: 160, y: 95 });
  stepUntil(state, NONE, (s) => s.phase !== 'running');
  assert.equal(state.phase, 'disqualified');
  assert.equal(state.reason, 'missedPoles');
  assert.equal(state.missed, 2);
  assert.deepEqual(state.events.at(-1), { type: 'disqualified', reason: 'missedPoles' });
});

test('hitting a pole slows the skier and is judged separately from the side', () => {
  const state = running({ x: 140, y: 97, speed: 60 });
  stepUntil(state, NONE, (s) => s.nextPole > 0);
  assert.equal(state.hits, 1);
  assert.equal(state.poles[0].hit, true);
  assert.ok(state.speed < 60 * SLALOM_CONFIG.hitSpeedFactor + 5);
  assert.equal(state.poles[0].result, 'missed');
});

test('a hit pole is counted only once', () => {
  const state = running({ x: 120, y: 97, speed: 30 });
  state.x = 138;
  stepUntil(state, NONE, (s) => s.nextPole > 0);
  assert.equal(state.hits, 1);
  assert.equal(state.poles[0].result, 'passed');
});

test('crossing a fence disqualifies immediately', () => {
  const state = running({ x: 62, y: 10, angle: -SLALOM_CONFIG.maxAngle, speed: 150 });
  stepUntil(state, { ...NONE, left: true }, (s) => s.phase !== 'running');
  assert.equal(state.phase, 'disqualified');
  assert.equal(state.reason, 'outOfBounds');
});

test('crossing the finish line stops the clock at the exact crossing', () => {
  const course = { ...TINY_COURSE, poles: [] };
  const state = Object.assign(createSlalomState(course), { phase: 'running', y: 295, speed: 120, time: 10 });
  stepSlalom(state, NONE, DT);
  assert.equal(state.phase, 'running');
  stepUntil(state, NONE, (s) => s.phase !== 'running');
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 10 && state.time < 10 + 4 * DT);
  assert.ok(state.events.some((e) => e.type === 'finish'));
});

test('a finished or disqualified run does not move', () => {
  const state = running({ phase: 'finished', y: 300 });
  stepSlalom(state, { left: false, right: true, pushes: 3 }, DT);
  assert.equal(state.y, 300);
  assert.deepEqual(state.events, []);
});
