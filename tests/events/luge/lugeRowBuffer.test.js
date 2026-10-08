import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLuge } from '../../../game/events/luge/lugeRender.js';
import { createRowBuffer } from '../../../game/events/luge/lugeRowBuffer.js';
import { PixelSurface } from '../../helpers/pixelSurface.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

test('the row buffer is not used on a context without image data', () => {
  assert.equal(createRowBuffer(recordingCtx(), 640, 197, 315), null);
});

test('the row buffer paints opaque rects like fillRect, clipped to its rows', () => {
  const direct = new PixelSurface(40, 20);
  const buffered = new PixelSurface(40, 20);
  const buffer = createRowBuffer(buffered, 40, 5, 10);
  for (const target of [direct, buffer]) {
    for (let y = 5; y < 15; y++) {
      target.fillStyle = '#a0b0c0';
      target.fillRect(0, y, 40, 1);
    }
    target.fillStyle = '#123456';
    target.fillRect(-3, 6, 10, 3);
    target.fillStyle = '#FEDCBA';
    target.fillRect(30, 12, 20, 1);
  }
  buffer.fillRect(0, 0, 40, 5); // outside the buffer's rows: ignored
  buffer.put();
  assert.equal(buffered.differing(direct), 0);
});

test('a frame drawn with the row buffer has the same pixels as one drawn rect by rect, in far fewer rects', () => {
  const BASE = { time: 12.34, speedKmh: 96, lateral: 0, phase: 'ride', turn: 3, label: 'YRITYS 1/3' };
  const views = [
    { ...BASE, s: -3.4, phase: 'push', showRedLine: true, stride: 0.25, speedKmh: 8 },
    { ...BASE, s: 662, lateral: -0.5, curve: 1, showLine: true },
    { ...BASE, s: 1056, phase: 'finished', banner: 'MAALI!' },
  ];
  for (const view of views) {
    const buffered = new PixelSurface(640, 512);
    const direct = new PixelSurface(640, 512);
    direct.putImageData = undefined;
    renderLuge(buffered, view);
    renderLuge(direct, view);
    assert.equal(buffered.differing(direct), 0, `s=${view.s}`);
    assert.ok(buffered.calls.rects + 9000 < direct.calls.rects, `s=${view.s}: ${buffered.calls.rects} vs ${direct.calls.rects} rects`);
  }
});
