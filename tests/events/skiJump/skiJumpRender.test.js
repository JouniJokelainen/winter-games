import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../../game/engine/constants.js';
import { PALETTE } from '../../../game/engine/palette.js';
import { HILL, hillHeightAt } from '../../../game/events/skiJump/hill.js';
import {
  cameraFor, formatWind, PX_PER_M, renderSkiJump, skierPose, toScreen, windFlagLift,
} from '../../../game/events/skiJump/skiJumpRender.js';
import { createJumpState } from '../../../game/events/skiJump/skiJumpSim.js';

function recordingCtx() {
  const rects = [];
  return {
    rects,
    fillStyle: null,
    fillRect(x, y, w, h) {
      for (const value of [x, y, w, h]) {
        if (!Number.isFinite(value)) throw new Error(`non-finite rect value ${value}`);
      }
      rects.push({ x, y, w, h, color: this.fillStyle });
    },
  };
}

test('the camera keeps the skier on screen in every phase and stops at the outrun end', () => {
  const base = createJumpState(HILL);
  const states = [
    base,
    { ...base, phase: 'flight', x: 60, y: -20, lipTime: 4, time: 4.2 },
    { ...base, phase: 'flight', x: 150, y: -80, lipTime: 4, time: 8 },
  ];
  for (const state of states) {
    const { sx, sy } = toScreen(cameraFor(state), state.x, state.y);
    assert.ok(sx > 100 && sx < CANVAS_WIDTH - 100, `${state.phase} sx ${sx}`);
    assert.ok(sy > 100 && sy < CANVAS_HEIGHT - 100, `${state.phase} sy ${sy}`);
  }
  const end = { ...base, phase: 'landed', x: HILL.outrunEnd, y: hillHeightAt(HILL, HILL.outrunEnd), lipTime: 4, time: 12 };
  assert.equal(cameraFor(end).x, HILL.outrunEnd * PX_PER_M - CANVAS_WIDTH);
});

test('in flight the skier moves to the upper left so the slope ahead is visible', () => {
  const inrun = createJumpState(HILL);
  const flight = { ...inrun, phase: 'flight', x: 80, y: -30, lipTime: 4, time: 6 };
  const a = toScreen(cameraFor(inrun), inrun.x, inrun.y);
  const b = toScreen(cameraFor(flight), flight.x, flight.y);
  assert.ok(b.sx < a.sx && b.sy < a.sy);
});

test('wind flag lifts from hanging to horizontal and wind text uses a decimal comma', () => {
  assert.equal(windFlagLift(0), 0);
  assert.equal(windFlagLift(2), 0.5);
  assert.equal(windFlagLift(4), 1);
  assert.equal(windFlagLift(9), 1);
  assert.equal(formatWind(3.25), '3,3 M/S');
  assert.equal(formatWind(0), '0,0 M/S');
});

test('skierPose follows the phase', () => {
  const state = createJumpState(HILL);
  assert.equal(skierPose(state), 'crouch');
  assert.equal(skierPose({ ...state, phase: 'inrun' }), 'crouch');
  assert.equal(skierPose({ ...state, phase: 'flight' }), 'flight');
  assert.equal(skierPose({ ...state, phase: 'landed' }), 'telemark');
  assert.equal(skierPose({ ...state, phase: 'fallen' }), 'fallen');
});

test('renders every phase within the 640×512 canvas without errors', () => {
  const base = createJumpState(HILL, { wind: 2.4 });
  const states = [
    base,
    { ...base, phase: 'inrun', inrunDistance: 30, x: -15, y: 8, speed: 15 },
    { ...base, phase: 'flight', x: 60, y: -20, speed: 26, angle: 0.8, lipTime: 4, time: 5 },
    { ...base, phase: 'flight', x: 160, y: hillHeightAt(HILL, 160) + 2, speed: 28, angle: 0.8, lipTime: 4, time: 9 },
    { ...base, phase: 'landed', x: 185, y: hillHeightAt(HILL, 185), speed: 20, distance: 184.6, landing: 'perfect', lipTime: 4, time: 10 },
    { ...base, phase: 'fallen', x: 150, y: hillHeightAt(HILL, 150), speed: 0, distance: 150.2, landing: 'fall', lipTime: 4, time: 10 },
  ];
  for (const state of states) {
    const ctx = recordingCtx();
    renderSkiJump(ctx, { state, label: 'HYPPY 1/3', time: 0.2 });
    assert.ok(ctx.rects.length > 2000, `${state.phase}: ${ctx.rects.length} rects`);
  }
});

test('the shadow is drawn below a flying skier and is denser and darker near the ground', () => {
  const base = createJumpState(HILL, { wind: 0 });
  const shadowPixels = (height) => {
    const state = { ...base, phase: 'flight', x: 120, y: hillHeightAt(HILL, 120) + height, angle: 0.8, lipTime: 4, time: 7 };
    const ctx = recordingCtx();
    renderSkiJump(ctx, { state, label: 'HYPPY 1/3', time: 0 });
    const shades = [PALETTE.concrete1, PALETTE.concrete0, PALETTE.shadow];
    return ctx.rects.filter((r) => r.w === 1 && r.h === 1 && shades.includes(r.color));
  };
  const low = shadowPixels(2);
  const high = shadowPixels(24);
  assert.ok(low.length > high.length, `low ${low.length}, high ${high.length}`);
  assert.ok(low.some((r) => r.color === PALETTE.concrete1));
  assert.ok(!high.some((r) => r.color === PALETTE.concrete1));
});
