import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawCachedBackdrop } from '../../../game/events/luge/lugeBackdrop.js';
import { drawForestBackdrop, drawForestLayer, FOREST_LAYERS, FOREST_REACH, forestOffset } from '../../../game/events/luge/lugeForest.js';
import { HORIZON } from '../../../game/events/luge/lugeProjection.js';
import { drawLugeSky, drawSunAt, SUN_REACH } from '../../../game/events/luge/lugeSky.js';
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

test('the sun and the backdrop forest are drawn inside the sprites sized from SUN_REACH and FOREST_REACH', () => {
  const [halfW, halfH] = SUN_REACH;
  const sun = recordingCtx();
  drawSunAt(sun, halfW, halfH);
  assert.ok(sun.rects.length > 0);
  for (const r of sun.rects) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= halfW * 2 + 2 && r.y + r.h <= halfH * 2 + 2, JSON.stringify(r));
  for (const layer of FOREST_LAYERS) {
    for (const heading of [-0.1, 0.4, 1.1, 2.2]) {
      const ctx = recordingCtx();
      drawForestLayer(ctx, layer, { offset: forestOffset(layer, heading), horizon: FOREST_REACH, tint });
      assert.ok(ctx.rects.length > 0);
      for (const r of ctx.rects) assert.ok(r.y >= 1 && r.y + r.h <= FOREST_REACH + 1, `${layer.name}: ${JSON.stringify(r)}`);
    }
  }
});

// These two tests come last: a failed canvas kind is remembered by the module for the rest of the process.
test('an offscreen canvas without a 2d context falls back to a DOM canvas', () => {
  globalThis.OffscreenCanvas = class { getContext() { return null; } };
  let created = 0;
  globalThis.document = {
    createElement() {
      created += 1;
      const canvas = new Surface(1, 1);
      canvas.getContext = () => { canvas.px = new Float32Array(canvas.width * canvas.height * 4); return canvas; };
      return canvas;
    },
  };
  const freshTint = (color) => color; // a fresh tint: a fresh cache
  try {
    const cached = sky((ctx) => assert.ok(drawCachedBackdrop(ctx, { heading: 0, clock: 0, horizon: HORIZON, tint: freshTint, headingRange: RANGE })));
    assert.ok(created > 10, `${created} DOM canvases`);
    assert.equal(differing(cached, direct(0, 0)), 0);
  } finally {
    delete globalThis.OffscreenCanvas;
    delete globalThis.document;
  }
});

test('when no canvas has a 2d context the backdrop falls back to direct drawing and does not retry every frame', () => {
  let created = 0;
  globalThis.OffscreenCanvas = class { constructor() { created += 1; } getContext() { return null; } };
  const otherTint = (color) => color; // a fresh tint: a fresh cache
  try {
    for (let frame = 0; frame < 3; frame++) {
      const surface = new Surface(W, HORIZON);
      assert.equal(drawCachedBackdrop(surface, { heading: 0, clock: 0, horizon: HORIZON, tint: otherTint, headingRange: RANGE }), false);
      assert.deepEqual(surface.calls, { rects: 0, images: 0 });
    }
    assert.ok(created <= 1, `${created} canvases made over 3 frames`);
  } finally {
    delete globalThis.OffscreenCanvas;
  }
});
