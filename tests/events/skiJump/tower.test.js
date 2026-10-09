import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE } from '../../../game/engine/palette.js';
import { HILL } from '../../../game/events/skiJump/hill.js';
import { renderSkiJump } from '../../../game/events/skiJump/skiJumpRender.js';
import { createJumpState } from '../../../game/events/skiJump/skiJumpSim.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

function render(state, time = 1) {
  const ctx = recordingCtx();
  renderSkiJump(ctx, { state, label: 'X', time });
  return ctx.rects;
}

const colors = (rects) => new Set(rects.map((r) => r.color));

test('at the start the steel tower, the glass start house and the flags are drawn', () => {
  const used = colors(render(createJumpState(HILL, { wind: 2 })));
  for (const color of [PALETTE.steelLit, PALETTE.steelDark, PALETTE.glass, PALETTE.railRed, PALETTE.guide]) {
    assert.ok(used.has(color), color);
  }
});

test('the landing hill has advertising boards, wind screens and the judges tower', () => {
  const state = { ...createJumpState(HILL, { wind: 2 }), phase: 'flight', x: 120, y: -50, vx: 20, vy: -5, time: 4, lipTime: 2 };
  const rects = render(state);
  const used = colors(rects);
  for (const color of [PALETTE.boardBlue, PALETTE.boardRed, PALETTE.concrete1, PALETTE.glassDark]) assert.ok(used.has(color), color);
  assert.ok(rects.some((r) => typeof r.color === 'string' && r.color.startsWith('rgba')), 'wind screen netting');
});

test('the flags ripple with time and more with the wind', () => {
  const flagRects = (wind, time) => render(createJumpState(HILL, { wind }), time).filter((r) => r.color === PALETTE.red && r.w === 1);
  assert.notDeepEqual(flagRects(2, 1), flagRects(2, 1.2));
  const spread = (rects) => Math.max(...rects.map((r) => r.y)) - Math.min(...rects.map((r) => r.y));
  assert.ok(spread(flagRects(4, 1)) >= spread(flagRects(0, 1)));
});

test('every rectangle is drawn in whole pixels', () => {
  for (const state of [createJumpState(HILL, { wind: 1 }), { ...createJumpState(HILL), phase: 'flight', x: 150, y: -60, time: 3, lipTime: 1 }]) {
    for (const r of render(state)) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), JSON.stringify(r));
  }
});
