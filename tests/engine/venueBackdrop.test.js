import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../game/engine/constants.js';
import { drawGradientText } from '../../game/engine/font.js';
import { PALETTE } from '../../game/engine/palette.js';
import { drawVenueBackdrop, mix, skyColorAt } from '../../game/engine/venueBackdrop.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

function draw(time) {
  const ctx = recordingCtx();
  drawVenueBackdrop(ctx, time);
  return ctx.rects;
}

test('mix blends two colours', () => {
  assert.equal(mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(mix('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mix('#000000', '#fe0080', 0.5), '#7f0040');
});

test('the sky is a smooth gradient from the dawn blue to the peach horizon', () => {
  assert.equal(skyColorAt(-50), PALETTE.dawnTop);
  assert.equal(skyColorAt(5000), PALETTE.dawnHorizon);
  const colors = new Set(Array.from({ length: 110 }, (_, i) => skyColorAt(i * 4)));
  assert.ok(colors.size > 80, `${colors.size} sky colours`);
});

test('the venue backdrop is deterministic, drifts with time and uses whole pixels', () => {
  const start = draw(0);
  assert.deepEqual(start, draw(0));
  assert.notDeepEqual(start, draw(10));
  assert.deepEqual(start[0], { x: 0, y: 0, w: CANVAS_WIDTH, h: 4, color: skyColorAt(2) });
  for (const r of start) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), JSON.stringify(r));
});

test('the backdrop has ridges with snow caps, the distant jump, a forest and the snowy plain', () => {
  const rects = draw(0);
  for (const [color, what] of [
    [PALETTE.farRockLit, 'far ridge'], [PALETTE.nearRockShade, 'near ridge'], [PALETTE.capLit, 'snow caps'],
    [PALETTE.sunCore, 'sun'], [PALETTE.wood2, 'inrun'], [PALETTE.concrete2, 'pillars'], [PALETTE.pineDark, 'forest'],
  ]) {
    assert.ok(rects.some((r) => r.color === color), what);
  }
  assert.ok(rects.some((r) => r.color === PALETTE.snowLight && r.w === CANVAS_WIDTH && r.y + r.h === CANVAS_HEIGHT), 'snowy plain');
});

test('the distant ski jump stays clear of the title menu panel', () => {
  for (const time of [0, 600]) {
    const wood = draw(time).filter((r) => r.color === PALETTE.wood2);
    assert.ok(wood.length > 0);
    for (const r of wood) assert.ok(r.x > 460, `x=${r.x} at ${time}`);
  }
});

test('the jumper rides the inrun, flies off and is gone for the rest of the loop', () => {
  const suit = (time) => draw(time).filter((r) => r.color === PALETTE.skierSuit);
  assert.ok(suit(1).length > 0, 'on the inrun');
  assert.ok(suit(1).every((r) => r.x >= 480 && r.x < 600));
  assert.ok(suit(4.5).some((r) => r.x >= 580), 'in flight');
  assert.equal(suit(6.5).length, 0, 'gone');
});

test('gradient text colours the glyph rows top to bottom over an outline and an extrusion', () => {
  const ctx = recordingCtx();
  const colors = ['#ff0000', '#00ff00', '#0000ff'];
  drawGradientText(ctx, 'I', 100, 50, { scale: 4, colors, outline: '#111111', depth: '#222222' });
  const fill = ctx.rects.filter((r) => colors.includes(r.color));
  assert.deepEqual([...new Set(fill.map((r) => r.color))], colors);
  const topFill = fill.filter((r) => r.color === colors[0]);
  const bottomFill = fill.filter((r) => r.color === colors[2]);
  assert.ok(Math.max(...topFill.map((r) => r.y)) < Math.min(...bottomFill.map((r) => r.y)));
  assert.ok(ctx.rects.some((r) => r.color === '#111111'));
  assert.ok(ctx.rects.some((r) => r.color === '#222222'));
  assert.ok(ctx.rects.findIndex((r) => r.color === '#222222') < ctx.rects.findIndex((r) => r.color === colors[0]));
});
