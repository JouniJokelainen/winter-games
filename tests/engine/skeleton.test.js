import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillCapsule, fillTaper, fillTaperRuns, pixelRuns, shaded, solid, transform } from '../../game/engine/skeleton.js';
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

test('fillTaper draws whole 1×1 pixels and is wider near the thick end', () => {
  const ctx = recordingCtx();
  fillTaper(ctx, 20.5, 10.5, 20.5, 50.5, 8, 3, solid('#abcdef'));
  assert.ok(ctx.rects.length > 0);
  for (const r of ctx.rects) {
    assert.deepEqual([r.w, r.h, r.color], [1, 1, '#abcdef']);
    assert.ok(Number.isInteger(r.x) && Number.isInteger(r.y));
  }
  const widthAt = (y) => ctx.rects.filter((r) => r.y === y).length;
  assert.ok(widthAt(14) > widthAt(46) + 4, `${widthAt(14)} vs ${widthAt(46)}`);
});

test('fillTaper with equal radii covers the same pixels as fillCapsule', () => {
  const key = (r) => `${r.x},${r.y}`;
  const a = recordingCtx();
  const b = recordingCtx();
  fillCapsule(a, 12.3, 40.7, 37.9, 18.2, 5.5, solid('#000000'));
  fillTaper(b, 12.3, 40.7, 37.9, 18.2, 5.5, 5.5, solid('#000000'));
  assert.deepEqual(b.rects.map(key).sort(), a.rects.map(key).sort());
});

test('fillTaper passes the across offset and the position along the limb to the colour callback', () => {
  const seen = [];
  fillTaper(recordingCtx(), 10.5, 30.5, 10.5, 10.5, 6, 4, (across, t) => { seen.push([across, t]); return '#000000'; });
  assert.ok(seen.every(([across, t]) => across >= -1 - 1e-9 && across <= 1 + 1e-9 && t >= 0 && t <= 1));
  assert.ok(seen.some(([across]) => across < -0.5) && seen.some(([across]) => across > 0.5));
});

// Paints rects into a map of pixel -> colour (opaque, last one wins), like a canvas would.
function pixelBuffer(rects) {
  const px = new Map();
  for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) px.set(`${x},${y}`, r.color);
  return px;
}

test('fillTaperRuns paints exactly the pixels of fillTaper with far fewer rects', () => {
  const colorAt = (across, t) => (across > 0.4 ? '#111111' : t > 0.5 ? '#222222' : '#333333');
  for (const [ax, ay, bx, by, ra, rb] of [[12.3, 40.7, 37.9, 18.2, 5.5, 3.1], [20.5, 10.5, 20.5, 50.5, 8, 3], [5.2, 5.9, 60.1, 9.4, 2.2, 6.7], [30, 30, 30.2, 30.1, 4.4, 4.4]]) {
    const a = recordingCtx();
    const b = recordingCtx();
    fillTaper(a, ax, ay, bx, by, ra, rb, colorAt);
    fillTaperRuns(b, ax, ay, bx, by, ra, rb, colorAt);
    assert.deepEqual(pixelBuffer(b.rects), pixelBuffer(a.rects));
    assert.ok(b.rects.length * 2 < a.rects.length, `${b.rects.length} runs vs ${a.rects.length} pixels`);
    for (const r of b.rects) assert.equal(r.h, 1);
  }
});

test('pixelRuns merges same-colour neighbours in a row and passes other rects through in order', () => {
  const ctx = recordingCtx();
  const runs = pixelRuns(ctx);
  runs.fillStyle = '#aaaaaa';
  runs.fillRect(3, 7, 1, 1);
  runs.fillRect(4, 7, 1, 1);
  runs.fillRect(5, 7, 1, 1);
  runs.fillStyle = '#bbbbbb';
  runs.fillRect(6, 7, 1, 1);
  runs.fillRect(6, 8, 1, 1);
  runs.fillRect(0, 0, 4, 2);
  runs.fillRect(9, 8, 1, 1);
  runs.flush();
  assert.deepEqual(ctx.rects, [
    { x: 3, y: 7, w: 3, h: 1, color: '#aaaaaa' },
    { x: 6, y: 7, w: 1, h: 1, color: '#bbbbbb' },
    { x: 6, y: 8, w: 1, h: 1, color: '#bbbbbb' },
    { x: 0, y: 0, w: 4, h: 2, color: '#bbbbbb' },
    { x: 9, y: 8, w: 1, h: 1, color: '#bbbbbb' },
  ]);
});
