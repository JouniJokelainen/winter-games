import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE } from '../../../game/engine/palette.js';
import { SKIER_STYLES } from '../../../game/events/skiJump/skier.js';
import { drawSlalomSkier } from '../../../game/events/slalom/slalomSkier.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

const draw = (lean, fallen = false) => {
  const ctx = recordingCtx();
  drawSlalomSkier(ctx, SKIER_STYLES.classic, 300, 200, lean, fallen);
  return ctx.rects;
};

const averageX = (rects) => rects.reduce((sum, r) => sum + r.x, 0) / rects.length;

test('every pose draws whole pixels in the style C colours', () => {
  for (const rects of [draw(-1), draw(0), draw(1), draw(0, true)]) {
    assert.ok(rects.length > 300, `${rects.length} pixels`);
    for (const r of rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), JSON.stringify(r));
    const colors = new Set(rects.map((r) => r.color));
    for (const color of [PALETTE.red, PALETTE.skierSuit, PALETTE.skierBib, PALETTE.skierSki]) {
      assert.ok(colors.has(color), color);
    }
  }
});

test('the ski tips point the way the skier is turning', () => {
  const tipX = (rects) => {
    const skis = rects.filter((r) => r.color === PALETTE.skierSki || r.color === PALETTE.skierSkiShade);
    const lowest = Math.max(...skis.map((r) => r.y));
    return averageX(skis.filter((r) => r.y >= lowest - 2));
  };
  assert.ok(Math.abs(tipX(draw(0)) - 300) <= 8, `straight ${tipX(draw(0))}`);
  assert.ok(tipX(draw(0.8)) > 310, `right ${tipX(draw(0.8))}`);
  assert.ok(tipX(draw(-0.8)) < 290, `left ${tipX(draw(-0.8))}`);
});

test('the body leans into the turn', () => {
  const gogglesX = (rects) => averageX(rects.filter((r) => r.color === PALETTE.skierGoggleFrame));
  assert.ok(Math.abs(gogglesX(draw(0)) - 300) <= 2);
  assert.ok(gogglesX(draw(0.8)) > 305);
  assert.ok(gogglesX(draw(-0.8)) < 295);
});

test('a fallen skier lies flat in the snow', () => {
  const rects = draw(0, true);
  const xs = rects.map((r) => r.x);
  const ys = rects.map((r) => r.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys));
});
