import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE } from '../../../game/engine/palette.js';
import { COURSE } from '../../../game/events/slalom/course.js';
import { renderSlalom, SKIER_SCREEN_Y, WORLD_SCALE } from '../../../game/events/slalom/slalomRender.js';
import { createSlalomState } from '../../../game/events/slalom/slalomSim.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

const RETRO_COLORS = [PALETTE.yellow, PALETTE.ice, PALETTE.blue, PALETTE.navy, PALETTE.pine, PALETTE.brown];

function states() {
  const base = createSlalomState(COURSE);
  base.poles[0] = { hit: true, result: 'passed' };
  base.poles[1] = { hit: false, result: 'missed' };
  return [
    base,
    { ...base, phase: 'running', y: 520, x: 200, angle: 0.3, speed: 150, time: 3.5 },
    { ...base, phase: 'finished', y: COURSE.finishY + 2, speed: 200, time: 30.12 },
    { ...base, phase: 'disqualified', reason: 'outOfBounds', y: 900, x: 59 },
  ];
}

function render(state, time = 0.2) {
  const ctx = recordingCtx();
  renderSlalom(ctx, { state, track: [{ x: 160, y: 10 }, { x: 161, y: 12 }], label: 'YRITYS 1/3', time });
  return ctx.rects;
}

test('renders every phase in whole canvas pixels without the old retro colours', () => {
  for (const state of states()) {
    const rects = render(state);
    assert.ok(rects.length > 2000, `${state.phase}: ${rects.length} rects`);
    for (const r of rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${state.phase} ${JSON.stringify(r)}`);
    const used = new Set(rects.map((r) => r.color));
    for (const color of RETRO_COLORS) assert.ok(!used.has(color), `${state.phase} still uses ${color}`);
  }
});

test('the skier is drawn in the upper part of the view at canvas scale', () => {
  const running = states()[1];
  const suit = render(running).filter((r) => r.color === PALETTE.skierSuit);
  assert.ok(suit.length > 0);
  const skierY = SKIER_SCREEN_Y * WORLD_SCALE;
  for (const r of suit) assert.ok(r.y > skierY - 60 && r.y < skierY, `suit pixel at ${r.y}`);
  const skierX = running.x * WORLD_SCALE;
  const meanX = suit.reduce((sum, r) => sum + r.x, 0) / suit.length;
  assert.ok(Math.abs(meanX - skierX) < 12, `suit x ${meanX} vs ${skierX}`);
});

test('standing gates cast a slanted shadow on the snow', () => {
  // Poles 0 (red, y 300) and 1 (blue, y 530) are both in view, untouched.
  const state = { ...createSlalomState(COURSE), phase: 'running', y: 340, x: 160, speed: 120, time: 2 };
  const rects = render(state);
  assert.ok(rects.some((r) => r.color === PALETTE.shadow && r.w === 1 && r.h === 2), 'pole shadow');
  assert.ok(rects.some((r) => r.color === PALETTE.red && r.w === 4 && r.h === 28), 'red pole');
  assert.ok(rects.some((r) => r.color === PALETTE.guide && r.w === 4 && r.h === 28), 'blue pole');
});

test('the start hut and the finish banner appear at their ends of the course', () => {
  const [ready, , finished] = states();
  assert.ok(render(ready).some((r) => r.color === PALETTE.wood3 && r.w === 84), 'start hut wall');
  assert.ok(render(finished).some((r) => r.color === PALETTE.red && r.w === 400 && r.h === 20), 'finish banner');
});
