import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillCapsule, shaded, solid, transform } from '../../game/engine/skeleton.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

test('fillCapsule rasterises a disc as whole pixels in the chosen colour', () => {
  const ctx = recordingCtx();
  fillCapsule(ctx, 10.5, 10.5, 10.5, 10.5, 2, solid('#123456'));
  assert.ok(ctx.rects.length >= 9 && ctx.rects.length <= 16, `${ctx.rects.length} pixels`);
  for (const r of ctx.rects) {
    assert.deepEqual([r.w, r.h, r.color], [1, 1, '#123456']);
    assert.ok(Number.isInteger(r.x) && Number.isInteger(r.y));
  }
});

test('transform rotates counter-clockwise with y up', () => {
  assert.deepEqual(transform(100, 100, 0, [10, 0]), [110, 100]);
  const [x, y] = transform(100, 100, Math.PI / 2, [10, 0]);
  assert.ok(Math.abs(x - 100) < 1e-9 && Math.abs(y - 90) < 1e-9, `${x},${y}`);
});

test('shaded picks the dark colour past the split', () => {
  const colorAt = shaded('light', 'dark', 0.35);
  assert.equal(colorAt(0), 'light');
  assert.equal(colorAt(0.5), 'dark');
});
