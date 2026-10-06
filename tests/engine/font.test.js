import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawText, GLYPHS, glyphFor, textWidth } from '../../game/engine/font.js';

function recordingCtx() {
  const rects = [];
  return {
    rects,
    fillStyle: null,
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, color: this.fillStyle }); },
  };
}

test('every glyph is 7 rows of 5 characters using # and .', () => {
  for (const [char, rows] of Object.entries(GLYPHS)) {
    assert.equal(rows.length, 7, char);
    for (const row of rows) assert.match(row, /^[#.]{5}$/, char);
  }
});

test('font covers the Finnish alphabet, digits and common punctuation', () => {
  for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÅ0123456789 .,:-+!?/()\'%=<>_°') {
    assert.ok(GLYPHS[char], `missing glyph ${char}`);
  }
});

test('lowercase maps to uppercase and unknown characters to ?', () => {
  assert.equal(glyphFor('ä'), GLYPHS['Ä']);
  assert.equal(glyphFor('@'), GLYPHS['?']);
});

test('textWidth uses a 6 px advance without trailing spacing', () => {
  assert.equal(textWidth(''), 0);
  assert.equal(textWidth('A'), 5);
  assert.equal(textWidth('AB'), 11);
  assert.equal(textWidth('AB', 2), 22);
});

test('drawText paints one rect per lit pixel, scaled and aligned', () => {
  const ctx = recordingCtx();
  drawText(ctx, 'I', 10, 20, { color: '#fff' });
  assert.equal(ctx.rects.length, 11);
  assert.deepEqual(ctx.rects[0], { x: 11, y: 20, w: 1, h: 1, color: '#fff' });

  const centered = recordingCtx();
  drawText(centered, 'I', 100, 0, { scale: 2, align: 'center' });
  assert.equal(Math.min(...centered.rects.map((r) => r.x)), 95 + 2);
  assert.equal(centered.rects[0].w, 2);
});

test('drawText draws the shadow first, offset by scale', () => {
  const ctx = recordingCtx();
  drawText(ctx, '.', 0, 0, { color: '#fff', shadow: '#000' });
  const shadowRects = ctx.rects.filter((r) => r.color === '#000');
  const textRects = ctx.rects.filter((r) => r.color === '#fff');
  assert.equal(ctx.rects[0].color, '#000');
  assert.equal(shadowRects.length, textRects.length);
  assert.equal(shadowRects[0].x, textRects[0].x + 1);
  assert.equal(shadowRects[0].y, textRects[0].y + 1);
});
