import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../game/engine/constants.js';
import { PALETTE } from '../../game/engine/palette.js';
import {
  drawForestLayer, drawMistySky, drawSnowfall, drawVenueBackdrop, FAR_FOREST, NEAR_FOREST,
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

test('the venue backdrop is deterministic, drifts with time and shows the distant ski jump', () => {
  const draw = (time) => {
    const ctx = recordingCtx();
    drawVenueBackdrop(ctx, time);
    return ctx.rects;
  };
  const start = draw(0);
  assert.deepEqual(start, draw(0));
  assert.notDeepEqual(start, draw(10));
  assert.deepEqual(start[0], { x: 0, y: 0, w: CANVAS_WIDTH, h: 103, color: PALETTE.mist0 });
  for (const r of start) {
    assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), JSON.stringify(r));
  }
  assert.ok(start.some((r) => r.color === PALETTE.wood2), 'distant inrun');
  assert.ok(start.some((r) => r.color === PALETTE.concrete2), 'distant pillars');
  assert.ok(start.some((r) => r.color === PALETTE.snowLight && r.w === CANVAS_WIDTH), 'snowy plain');
});

test('the distant ski jump stays clear of the title menu panel', () => {
  const draw = (time) => {
    const ctx = recordingCtx();
    drawVenueBackdrop(ctx, time);
    return ctx.rects;
  };
  for (const time of [0, 600]) {
    const rects = draw(time);
    const jumpRects = rects.filter((r) => r.color === PALETTE.wood2);
    assert.ok(jumpRects.length > 0, `at least one wood2 rect exists at time ${time}`);
    for (const r of jumpRects) {
      assert.ok(r.x > 460, `wood2 rect at time ${time} has x=${r.x} > 460`);
    }
  }
});
