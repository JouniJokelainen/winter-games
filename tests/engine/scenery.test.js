import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../game/engine/constants.js';
import { PALETTE } from '../../game/engine/palette.js';
import {
  drawForestLayer, drawMistySky, drawSnowfall, FAR_FOREST, NEAR_FOREST,
} from '../../game/engine/scenery.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

test('the misty sky starts with full-width bands from the top', () => {
  const ctx = recordingCtx();
  drawMistySky(ctx, { x: 0, y: 1200 });
  assert.deepEqual(ctx.rects[0], { x: 0, y: 0, w: CANVAS_WIDTH, h: 103, color: PALETTE.mist0 });
  assert.ok(ctx.rects.some((r) => r.color === PALETTE.snowDark));
});

test('forest layers are deterministic and scroll with the camera', () => {
  const draw = (x) => {
    const ctx = recordingCtx();
    drawForestLayer(ctx, { x, y: 1200 }, NEAR_FOREST);
    return ctx.rects;
  };
  assert.deepEqual(draw(0), draw(0));
  assert.notDeepEqual(draw(0), draw(40));
  assert.ok(draw(0).some((r) => r.color === PALETTE.pineDark));
  assert.ok(FAR_FOREST.parallax < NEAR_FOREST.parallax);
});

test('snowfall draws 140 flakes inside the canvas', () => {
  const ctx = recordingCtx();
  drawSnowfall(ctx, 3.7);
  assert.equal(ctx.rects.length, 140);
  for (const r of ctx.rects) {
    assert.ok(r.x >= 0 && r.x < CANVAS_WIDTH && r.y >= 0 && r.y < CANVAS_HEIGHT, `${r.x},${r.y}`);
  }
});
