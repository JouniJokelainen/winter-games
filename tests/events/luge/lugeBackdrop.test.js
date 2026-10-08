import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawCachedBackdrop } from '../../../game/events/luge/lugeBackdrop.js';
import { drawForestBackdrop } from '../../../game/events/luge/lugeForest.js';
import { HORIZON } from '../../../game/events/luge/lugeProjection.js';
import { drawLugeSky } from '../../../game/events/luge/lugeSky.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

// A small RGBA float surface with source-over fillRect (hex or rgba colours) and unscaled whole-pixel drawImage.
class Surface {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.px = new Float32Array(width * height * 4);
    this.fillStyle = '#000000';
    this.calls = { rects: 0, images: 0 };
  }

  getContext() {
    return this;
  }

  blend(i, r, g, b, a) {
    const px = this.px;
    px[i] = px[i] * (1 - a) + r * a;
    px[i + 1] = px[i + 1] * (1 - a) + g * a;
    px[i + 2] = px[i + 2] * (1 - a) + b * a;
    px[i + 3] = px[i + 3] * (1 - a) + a;
  }

  fillRect(x, y, w, h) {
    this.calls.rects += 1;
    const style = this.fillStyle;
    const [r, g, b, a] = style.startsWith('#')
      ? [...[1, 3, 5].map((i) => parseInt(style.slice(i, i + 2), 16)), 1]
      : style.match(/[\d.]+/g).map(Number);
    for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) this.blend((yy * this.width + xx) * 4, r, g, b, a);
    }
  }

  drawImage(img, ...args) {
    this.calls.images += 1;
    const [sx, sy, sw, sh, dx, dy] = args.length === 2 ? [0, 0, img.width, img.height, ...args] : args;
    assert.ok([sx, sy, dx, dy].every(Number.isInteger), `whole-pixel drawImage ${args}`);
    if (args.length > 2) assert.deepEqual([args[6], args[7]], [sw, sh], 'unscaled drawImage');
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const [tx, ty, fx, fy] = [dx + x, dy + y, sx + x, sy + y];
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height || fx < 0 || fy < 0 || fx >= img.width || fy >= img.height) continue;
        const si = (fy * img.width + fx) * 4;
        const a = img.px[si + 3];
        if (a > 0) this.blend((ty * this.width + tx) * 4, img.px[si] / a, img.px[si + 1] / a, img.px[si + 2] / a, a);
      }
    }
  }
}

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
