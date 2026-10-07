import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HILL, hillHeightAt } from '../../../game/events/skiJump/hill.js';
import {
  angleEfficiency, classifyLanding, createJumpState, JUMP_CONFIG, stepJump, takeoffQuality,
} from '../../../game/events/skiJump/skiJumpSim.js';

const DT = 1 / 60;
const DEG = Math.PI / 180;
const NONE = { up: false, down: false, presses: 0 };

function runInrun(state, pressAtTimeToLip = null) {
  stepJump(state, { ...NONE, presses: 1 }, DT);
  let pressed = false;
  while (state.phase === 'inrun') {
    const timeToLip = (state.hill.inrunLength - state.inrunDistance) / Math.max(state.speed, 0.1);
    const press = pressAtTimeToLip !== null && !pressed && timeToLip <= pressAtTimeToLip;
    if (press) pressed = true;
    stepJump(state, { ...NONE, presses: press ? 1 : 0 }, DT);
  }
  return state;
}

function flightState(overrides = {}) {
  return Object.assign(createJumpState(HILL), {
    phase: 'flight', lipTime: 0, time: 3, takeoff: { quality: 1, late: false },
  }, overrides);
}

test('stays ready until Space, then starts the inrun', () => {
  const state = createJumpState(HILL);
  stepJump(state, NONE, DT);
  assert.equal(state.phase, 'ready');
  assert.equal(state.time, 0);
  stepJump(state, { ...NONE, presses: 1 }, DT);
  assert.equal(state.phase, 'inrun');
  assert.deepEqual(state.events, [{ type: 'start' }]);
});

test('the inrun reaches the lip in about 4 s at 88 km/h in calm, faster with tailwind', () => {
  const calm = runInrun(createJumpState(HILL, { wind: 0 }));
  const windy = runInrun(createJumpState(HILL, { wind: 4 }));
  assert.equal(calm.phase, 'flight');
  assert.ok(calm.lipTime > 4 && calm.lipTime < 4.6, `lip time ${calm.lipTime}`);
  assert.ok(Math.abs(calm.speed * 3.6 - 88) < 2, `calm lip speed ${calm.speed * 3.6}`);
  assert.ok(windy.speed > calm.speed + 0.5);
  assert.ok(windy.lipTime < calm.lipTime);
});

test('takeoffQuality: full window narrows with wind, then falls linearly to 0 at 0.5 s', () => {
  assert.equal(takeoffQuality(0.05, 0), 1);
  assert.equal(takeoffQuality(0.1, 0), 1);
  assert.equal(takeoffQuality(0.06, 4), 1);
  assert.ok(takeoffQuality(0.08, 4) < 1);
  assert.ok(Math.abs(takeoffQuality(0.3, 0) - 0.5) < 1e-9);
  assert.equal(takeoffQuality(0.5, 0), 0);
  assert.equal(takeoffQuality(0.9, 0), 0);
});

test('a press in the takeoff zone sets quality and gives a steeper launch', () => {
  const none = runInrun(createJumpState(HILL));
  const perfect = runInrun(createJumpState(HILL), 0.05);
  assert.equal(none.takeoff, null);
  assert.equal(perfect.takeoff.quality, 1);
  assert.equal(perfect.takeoff.late, false);
  assert.ok(perfect.vy > none.vy + 2);
});

test('presses before the takeoff zone are ignored', () => {
  const state = runInrun(createJumpState(HILL), 2);
  assert.equal(state.takeoff, null);
});

test('the first press shortly after the lip is a late takeoff that ends in a fall', () => {
  const state = runInrun(createJumpState(HILL));
  stepJump(state, { ...NONE, presses: 1 }, DT);
  assert.deepEqual(state.takeoff, { quality: 0, late: true });
  assert.ok(state.events.some((e) => e.type === 'lateTakeoff'));
  for (let i = 0; i < 60 * 15 && state.phase === 'flight'; i++) {
    stepJump(state, { ...NONE, presses: i === 120 ? 1 : 0 }, DT);
  }
  assert.equal(state.phase, 'fallen');
  assert.equal(state.landing, 'fall');
});

test('the body angle drifts upright and the arrows steer it', () => {
  const drifting = flightState({ x: 20, y: 5, vx: 25, vy: 0, angle: 40 * DEG });
  stepJump(drifting, NONE, DT);
  assert.ok(Math.abs(drifting.angle - (40 * DEG + JUMP_CONFIG.driftRate * DT)) < 1e-9);
  const up = flightState({ x: 20, y: 5, vx: 25, vy: 0, angle: 40 * DEG });
  const down = flightState({ x: 20, y: 5, vx: 25, vy: 0, angle: 40 * DEG });
  stepJump(up, { ...NONE, up: true }, DT);
  stepJump(down, { ...NONE, down: true }, DT);
  assert.ok(up.angle > drifting.angle);
  assert.ok(down.angle < 40 * DEG);
  const clamped = flightState({ x: 20, y: 5, vx: 25, vy: 0, angle: 89 * DEG });
  for (let i = 0; i < 10; i++) stepJump(clamped, { ...NONE, up: true }, DT);
  assert.equal(clamped.angle, JUMP_CONFIG.maxAngle);
});

test('gusts only happen with wind', () => {
  const calm = flightState({ x: 20, y: 5, vx: 25, vy: 0, wind: 0, rng: () => 1 });
  stepJump(calm, NONE, DT);
  assert.equal(calm.gust, 0);
  const windy = flightState({ x: 20, y: 5, vx: 25, vy: 0, wind: 4, rng: () => 1 });
  stepJump(windy, NONE, DT);
  assert.ok(Math.abs(windy.gust - JUMP_CONFIG.gustPerWind * 4) < 1e-9);
});

test('angle efficiency peaks at 45° and is symmetric', () => {
  assert.equal(angleEfficiency(45 * DEG), 1);
  assert.ok(angleEfficiency(30 * DEG) < 1);
  assert.ok(Math.abs(angleEfficiency(30 * DEG) - angleEfficiency(60 * DEG)) < 1e-9);
  assert.equal(angleEfficiency(0), angleEfficiency(90 * DEG));
  assert.ok(angleEfficiency(0) < 1e-9);
});

test('flying at 45° keeps more speed and height than flying flat', () => {
  const best = flightState({ x: 20, y: 5, vx: 25, vy: -5, angle: 45 * DEG });
  const flat = flightState({ x: 20, y: 5, vx: 25, vy: -5, angle: 0 });
  for (let i = 0; i < 30; i++) {
    stepJump(best, { ...NONE, down: true }, DT);
    best.angle = 45 * DEG;
    stepJump(flat, { ...NONE, down: true }, DT);
  }
  assert.ok(best.y > flat.y);
  assert.ok(best.speed > flat.speed);
});

test('classifyLanding uses the gap between the last press and touchdown', () => {
  assert.equal(classifyLanding(null, false), 'fall');
  assert.equal(classifyLanding(0.6, false), 'poor');
  assert.equal(classifyLanding(0.5, false), 'perfect');
  assert.equal(classifyLanding(0.3, false), 'perfect');
  assert.equal(classifyLanding(0.15, false), 'perfect');
  assert.equal(classifyLanding(0.1, false), 'fall');
  assert.equal(classifyLanding(0.3, true), 'fall');
});

test('touchdown measures the distance from the lip and records the landing', () => {
  const state = flightState({ x: 100, y: hillHeightAt(HILL, 100) + 0.3, vx: 20, vy: -20, time: 5, lastLandingPress: 4.7 });
  for (let i = 0; i < 60 && state.phase === 'flight'; i++) stepJump(state, NONE, DT);
  assert.equal(state.phase, 'landed');
  assert.equal(state.landing, 'perfect');
  assert.ok(state.distance > 100 && state.distance < 101, `distance ${state.distance}`);
  assert.equal(state.distance, Math.round(state.distance * 10) / 10);
  assert.deepEqual(state.events.at(-1), { type: 'touchdown', landing: 'perfect' });
});

test('distance is capped at 200 m', () => {
  const state = flightState({ x: 230, y: hillHeightAt(HILL, 230) + 0.3, vx: 25, vy: -10, time: 6, lastLandingPress: 5.7 });
  for (let i = 0; i < 60 && state.phase === 'flight'; i++) stepJump(state, NONE, DT);
  assert.equal(state.distance, 200);
});

test('after touchdown the skier slides and stops, a fallen skier stops sooner', () => {
  const landed = flightState({ x: 100, y: hillHeightAt(HILL, 100) + 0.3, vx: 20, vy: -20, time: 5, lastLandingPress: 4.7 });
  const fallen = flightState({ x: 100, y: hillHeightAt(HILL, 100) + 0.3, vx: 20, vy: -20, time: 5 });
  for (let i = 0; i < 60 * 2; i++) {
    stepJump(landed, NONE, DT);
    stepJump(fallen, NONE, DT);
  }
  assert.equal(fallen.phase, 'fallen');
  assert.ok(landed.x > fallen.x);
  for (let i = 0; i < 60 * 5; i++) stepJump(landed, NONE, DT);
  assert.equal(landed.speed, 0);
  assert.equal(landed.y, hillHeightAt(HILL, landed.x));
});
