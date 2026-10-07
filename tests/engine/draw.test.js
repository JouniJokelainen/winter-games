import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawPanel } from '../../game/engine/draw.js';
import { PALETTE } from '../../game/engine/palette.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

test('a panel is a translucent slate fill inside a 2 px border', () => {
  const ctx = recordingCtx();
  drawPanel(ctx, 100, 50, 200, 80);
  assert.deepEqual(ctx.rects, [
    { x: 102, y: 52, w: 196, h: 76, color: 'rgba(42, 45, 54, 0.88)' },
    { x: 100, y: 50, w: 200, h: 2, color: PALETTE.slateEdge },
    { x: 100, y: 128, w: 200, h: 2, color: PALETTE.slateEdge },
    { x: 100, y: 52, w: 2, h: 76, color: PALETTE.slateEdge },
    { x: 298, y: 52, w: 2, h: 76, color: PALETTE.slateEdge },
  ]);
});
