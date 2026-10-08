import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawCachedBackdrop } from '../../../game/events/luge/lugeBackdrop.js';
import { drawForestBackdrop } from '../../../game/events/luge/lugeForest.js';
import { HORIZON } from '../../../game/events/luge/lugeProjection.js';
import { drawLugeSky } from '../../../game/events/luge/lugeSky.js';
import { PixelSurface as Surface } from '../../helpers/pixelSurface.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

const W = 640;
const tint = (color) => color;
const RANGE = [-0.1, 2.2];

function sky(draw) {
  const ctx = new Surface(W, HORIZON + 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, HORIZON + 4);
  ctx.calls = { rects: 0, images: 0 };
  draw(ctx);
  return ctx;
}

const direct = (heading, clock) => sky((ctx) => drawLugeSky(ctx, { heading, clock, horizon: HORIZON }, () => drawForestBackdrop(ctx, { heading, horizon: HORIZON, tint })));

function differing(a, b) {
  let count = 0;
  for (let i = 0; i < a.px.length; i += 4) {
    if ([0, 1, 2].some((k) => Math.round(a.px[i + k]) !== Math.round(b.px[i + k]))) count += 1;
  }
  return count / (a.px.length / 4);
}

test('the cached backdrop is not used without a canvas factory or without drawImage, and then draws nothing', () => {
  const ctx = recordingCtx();
  assert.equal(drawCachedBackdrop(ctx, { heading: 0, clock: 0, horizon: HORIZON, tint, headingRange: RANGE }), false);
  assert.equal(ctx.rects.length, 0);
  const surface = new Surface(W, HORIZON);
  assert.equal(drawCachedBackdrop(surface, { heading: 0, clock: 0, horizon: HORIZON, tint, headingRange: RANGE }), false); // node: no canvas
  assert.deepEqual(surface.calls, { rects: 0, images: 0 });
});

test('the cached backdrop matches the direct drawing with a few dozen draw calls', () => {
  globalThis.OffscreenCanvas = class extends Surface {};
  try {
    for (const [heading, clock] of [[0, 0], [0, 7.3], [0.8, 12.4], [1.37, 30.1], [2.1, 3]]) {
      const cached = sky((ctx) => assert.ok(drawCachedBackdrop(ctx, { heading, clock, horizon: HORIZON, tint, headingRange: RANGE })));
      const reference = direct(heading, clock);
      assert.ok(cached.calls.images <= 30 && cached.calls.rects <= 60, JSON.stringify(cached.calls));
      assert.ok(reference.calls.rects > 10000, `${reference.calls.rects} direct rects`);
      const share = differing(cached, reference);
      // Whole-pixel offsets are exact; otherwise a few backdrop trees may sit one pixel off.
      if (heading === 0) assert.equal(share, 0, `heading ${heading}`);
      else assert.ok(share < 0.005, `heading ${heading}: ${(share * 100).toFixed(3)} % pixels differ`);
    }
    // Outside the cached heading range the caller draws directly.
    assert.equal(drawCachedBackdrop(new Surface(W, HORIZON), { heading: 9, clock: 0, horizon: HORIZON, tint, headingRange: RANGE }), false);
  } finally {
    delete globalThis.OffscreenCanvas;
  }
});
