import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINISH_S, RED_LINE_S, TURNS } from '../../../game/events/luge/lugeTrack.js';
import { createLugeState, LUGE_CONFIG, speedLimitAhead, speedLimitAtLateral, stepLuge, vSafe, vSafeOuter } from '../../../game/events/luge/lugeSim.js';

const DT = 1 / 60;
const NONE = { left: false, right: false, down: false, pushes: 0 };
// s = 130 is inside the first turn at full curvature: a right turn, so its outer side is the left (lateral < 0).
const MID_FIRST_TURN = 130;
const TIGHTEST_TURN = 670;

function running(overrides = {}) {
  return Object.assign(createLugeState(), { phase: 'running', s: MID_FIRST_TURN, v: 30 }, overrides);
}

test('stays ready until the first push, then starts pushing', () => {
  const state = createLugeState();
  stepLuge(state, NONE, DT);
  assert.equal(state.phase, 'ready');
  assert.equal(state.time, 0);
  stepLuge(state, { ...NONE, pushes: 1 }, DT);
  assert.equal(state.phase, 'pushing');
  assert.deepEqual(state.events, [{ type: 'start' }]);
  assert.ok(state.v >= LUGE_CONFIG.pushMin);
});

test('pushes raise the speed up to the cap and it decays without them', () => {
  const state = Object.assign(createLugeState(), { phase: 'pushing', v: 2 });
  stepLuge(state, { ...NONE, pushes: 1 }, DT);
  assert.ok(state.v > 2 + LUGE_CONFIG.pushImpulse - 0.05);
  stepLuge(state, { ...NONE, pushes: 50 }, DT);
  assert.equal(state.v, LUGE_CONFIG.pushMax);
  const before = state.v;
  stepLuge(state, NONE, DT);
  assert.ok(state.v < before);
  for (let i = 0; i < 600 && state.phase === 'pushing'; i++) stepLuge(state, NONE, DT);
  assert.ok(state.v >= LUGE_CONFIG.pushMin);
});

test('the push ends at the red line and the push speed carries on to the slope', () => {
  const state = createLugeState();
  let hopSpeed = 0;
  for (let tick = 0; tick < 60 * 30 && state.phase !== 'running'; tick++) {
    stepLuge(state, { ...NONE, pushes: tick % 7 === 0 ? 1 : 0 }, DT);
    if (state.events.some((event) => event.type === 'hop')) hopSpeed = state.v;
  }
  assert.equal(state.phase, 'running');
  assert.ok(state.s >= RED_LINE_S);
  assert.ok(hopSpeed > 2);
  assert.ok(state.time > 3 && state.time < 6, `push took ${state.time}`);
});

test('without tapping the runner keeps walking and still reaches the red line', () => {
  const state = createLugeState();
  stepLuge(state, { ...NONE, pushes: 1 }, DT);
  for (let tick = 0; tick < 60 * 30 && state.phase === 'pushing'; tick++) stepLuge(state, NONE, DT);
  assert.equal(state.phase, 'running');
  assert.ok(state.time > 12 && state.time < 18, `push took ${state.time}`);
});

test('in a turn the outer side speeds up, the inner side slows down, the centre is in between', () => {
  const after = (lateral) => {
    const state = running({ lateral });
    stepLuge(state, NONE, DT);
    return state.v;
  };
  const outer = after(-0.6);
  const centre = after(0);
  const inner = after(0.6);
  assert.ok(outer > centre && centre > inner, `${outer} ${centre} ${inner}`);
});

test('lateral position has no effect on speed on a straight', () => {
  const after = (lateral) => {
    const state = running({ s: 40, lateral });
    stepLuge(state, NONE, DT);
    return state.v;
  };
  assert.equal(after(-0.6), after(0.6));
});

test('the arrows move the sled sideways and it eases back to the centre', () => {
  const state = running({ s: 40 });
  for (let i = 0; i < 10; i++) stepLuge(state, { ...NONE, right: true }, DT);
  assert.ok(state.lateral > 0.4);
  const held = state.lateral;
  for (let i = 0; i < 20; i++) stepLuge(state, NONE, DT);
  assert.ok(state.lateral < held && state.lateral >= 0);
  for (let i = 0; i < 240; i++) {
    state.s = 40; // stay on the straight: the return only exists there
    stepLuge(state, NONE, DT);
  }
  assert.equal(state.lateral, 0);
});

test('braking slows the sled', () => {
  const free = running({ s: 40 });
  const braked = running({ s: 40 });
  stepLuge(free, NONE, DT);
  stepLuge(braked, { ...NONE, down: true }, DT);
  assert.ok(braked.v < free.v);
});

test('touching the rim is a crash', () => {
  const state = running({ s: 40, lateral: 0.99 });
  stepLuge(state, { ...NONE, right: true }, DT);
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'wall');
  assert.equal(state.lateral, 1);
  assert.deepEqual(state.events, [{ type: 'crash' }]);
});

test('the hold speed of the tightest turn is about 115 km/h on the centre line', () => {
  const limit = vSafe(TURNS[6].k);
  assert.ok(limit > 29 && limit < 34, `vSafe(${TURNS[6].k}) = ${limit}`);
});

test('too much speed slides the sled over the outer rim even when steering, a safe speed holds', () => {
  const drive = (v) => {
    const state = running({ s: TIGHTEST_TURN - 15, v, lateral: 0 });
    for (let i = 0; i < 90 && state.phase === 'running' && state.s < TIGHTEST_TURN + 40; i++) {
      stepLuge(state, { ...NONE, left: state.lateral > 0, right: state.lateral < 0 }, DT); // keep the sled in the middle
    }
    return state;
  };
  const fast = drive(50);
  assert.equal(fast.phase, 'crashed');
  assert.equal(fast.reason, 'wall');
  assert.equal(fast.lateral, -1, 'a right turn: the sled leaves over the left (outer) rim');
  const safe = drive(25);
  assert.equal(safe.phase, 'running');
  assert.ok(Math.abs(safe.lateral) < 0.5);
});

test('speed alone never ends a run: a fast sled with no steering is stopped only by the rim', () => {
  const state = running({ s: TIGHTEST_TURN, v: 60, lateral: 0 });
  stepLuge(state, NONE, DT);
  assert.equal(state.phase, 'running');
});

test('speedLimitAhead finds the tightest turn in range', () => {
  assert.equal(speedLimitAhead(0, 50), Infinity);
  assert.equal(speedLimitAhead(TIGHTEST_TURN - 10, 20), vSafe(TURNS[6].k));
  assert.ok(speedLimitAhead(600, 120) <= vSafe(TURNS[6].k));
});

test('crossing the finish line ends the run with an interpolated time', () => {
  const state = running({ s: FINISH_S - 0.1, v: 40, time: 29.9 });
  stepLuge(state, NONE, DT);
  assert.equal(state.phase, 'finished');
  assert.equal(state.s, FINISH_S);
  assert.deepEqual(state.events, [{ type: 'finish' }]);
  assert.ok(state.time > 29.9 && state.time < 29.9 + DT);
});

test('a finished or crashed run no longer changes', () => {
  for (const phase of ['finished', 'crashed']) {
    const state = running({ phase, s: 500, time: 20 });
    stepLuge(state, { ...NONE, right: true, pushes: 3 }, DT);
    assert.equal(state.s, 500);
    assert.equal(state.time, 20);
    assert.deepEqual(state.events, []);
  }
});

test('in a turn the sled drifts toward the outer wall, harder at higher speed', () => {
  const driftAt = (v) => {
    const state = running({ v, lateral: 0 });
    stepLuge(state, NONE, DT);
    return state.lateral;
  };
  assert.ok(driftAt(30) < 0, 'a right turn pushes the sled to the left');
  assert.ok(driftAt(45) < driftAt(30), 'more speed drifts harder');
  const left = running({ s: 412, v: 30, lateral: 0 }); // turn 4 is a left turn
  stepLuge(left, NONE, DT);
  assert.ok(left.lateral > 0, 'a left turn pushes the sled to the right');
});

test('steering against the drift holds the line', () => {
  const state = running({ v: 30, lateral: -0.3 });
  for (let i = 0; i < 30; i++) stepLuge(state, { ...NONE, right: true }, DT);
  assert.ok(state.lateral > -0.3, `lateral ${state.lateral}`);
});

test('there is no drift and no pull to the centre in a turn, but a pull on a straight', () => {
  const turn = running({ v: 0.001, lateral: -0.5 });
  stepLuge(turn, NONE, DT);
  assert.ok(Math.abs(turn.lateral - -0.5) < 1e-3, `lateral ${turn.lateral}`);
  const straight = running({ s: 40, lateral: -0.5 });
  stepLuge(straight, NONE, DT);
  assert.ok(straight.lateral > -0.5);
});

test('the safe speed is higher on the outer side and lower on the inner side', () => {
  const k = TURNS[0].k; // a right turn: lateral < 0 is the outer side
  assert.ok(vSafe(k, -0.8) > vSafe(k, 0));
  assert.ok(vSafe(k, 0) > vSafe(k, 0.8));
  assert.equal(vSafe(k), vSafe(k, 0));
  assert.equal(vSafe(k, -1), vSafeOuter(k, 1));
});

test('a run still going after the time limit is rejected as too slow', () => {
  const state = running({ s: 40, v: 5, time: LUGE_CONFIG.timeLimit - DT / 2 });
  stepLuge(state, NONE, DT);
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'time');
  assert.deepEqual(state.events, [{ type: 'crash' }]);
});

test('the outer side holds more speed than the centre and the inner side less', () => {
  const k = TURNS[0].k;
  const centre = vSafeOuter(k, 0);
  assert.ok(Math.abs(vSafeOuter(k, 1) / centre - 1 / Math.sqrt(0.5)) < 1e-9);
  assert.ok(Math.abs(vSafeOuter(k, -1) / centre - 1 / Math.sqrt(1.5)) < 1e-9);
});

test('speedLimitAtLateral follows the sled position', () => {
  const s = TIGHTEST_TURN - 10;
  const k = TURNS[6].k; // a right turn: lateral < 0 is the outer side
  assert.equal(speedLimitAtLateral(s, 20, 0), vSafe(k));
  assert.ok(speedLimitAtLateral(s, 20, -0.8) > speedLimitAtLateral(s, 20, 0.8));
  assert.equal(speedLimitAtLateral(0, 50, 0.5), Infinity);
});
