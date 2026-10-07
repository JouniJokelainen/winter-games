import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_HEIGHT, CANVAS_WIDTH, RESOLUTION_SCALE, SCREEN_HEIGHT, SCREEN_WIDTH,
} from '../../game/engine/constants.js';
import { PALETTE } from '../../game/engine/palette.js';

test('the canvas is the 320×256 logical screen doubled', () => {
  assert.deepEqual([SCREEN_WIDTH, SCREEN_HEIGHT, RESOLUTION_SCALE], [320, 256, 2]);
  assert.deepEqual([CANVAS_WIDTH, CANVAS_HEIGHT], [640, 512]);
});

test('palette colours are #rrggbb and the muted style keys exist', () => {
  for (const [key, value] of Object.entries(PALETTE)) assert.match(value, /^#[0-9a-f]{6}$/, key);
  for (const key of ['mist0', 'mist4', 'snowLight', 'wood0', 'wood8', 'trackIce', 'concrete3', 'pineDark', 'guide', 'shadow']) {
    assert.ok(PALETTE[key], key);
  }
  assert.equal(PALETTE.ice, '#d0e8f8');
});
