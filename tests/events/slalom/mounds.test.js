import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COURSE } from '../../../game/events/slalom/course.js';
import { buildMounds, drawMounds } from '../../../game/events/slalom/mounds.js';
import { createSlalomState } from '../../../game/events/slalom/slalomSim.js';
import { renderSlalom } from '../../../game/events/slalom/slalomRender.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

test('mounds are deterministic and spread along the whole course', () => {
  const mounds = buildMounds(COURSE);
  assert.deepEqual(mounds, buildMounds(COURSE));
  assert.ok(mounds.length > 10, `${mounds.length} mounds`);
  assert.ok(mounds.some((m) => m.y > COURSE.finishY / 2));
});

test('mounds stay inside the fences or outside them, and clear of the start and the finish', () => {
  for (const m of buildMounds(COURSE)) {
    assert.ok(m.y > 100 && m.y < COURSE.finishY - 100, `y ${m.y}`);
    if (m.outside) {
      const inside = m.x - m.rx > COURSE.fenceLeftX && m.x + m.rx < COURSE.fenceRightX;
      assert.ok(!inside, `outside mound at ${m.x}`);
    } else {
      assert.ok(m.x - m.rx >= COURSE.fenceLeftX && m.x + m.rx <= COURSE.fenceRightX, `piste mound at ${m.x}`);
    }
    assert.ok(m.rx >= 16 && m.ry < m.rx);
  }
});

test('only mounds in view are drawn, as whole pixels inside the canvas width', () => {
  const mounds = [{ x: 160, y: 100, rx: 40, ry: 18, outside: false }, { x: 160, y: 4000, rx: 40, ry: 18, outside: false }];
  const ctx = recordingCtx();
  drawMounds(ctx, mounds, 0);
  assert.ok(ctx.rects.length > 20);
  for (const r of ctx.rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger) && r.y < 512, JSON.stringify(r));
  const none = recordingCtx();
  drawMounds(none, mounds, 2000);
  assert.equal(none.rects.length, 0);
});

test('the slalom render draws mounds under the track and the poles', () => {
  const mound = buildMounds(COURSE).find((m) => !m.outside);
  const state = { ...createSlalomState(COURSE), phase: 'running', x: 160, y: mound.y + 20, speed: 100, time: 2 };
  const ctx = recordingCtx();
  renderSlalom(ctx, { state, track: [], label: 'X', time: 1 });
  const first = ctx.rects.findIndex((r) => typeof r.color === 'string' && r.color.startsWith('rgba'));
  assert.ok(first > 0, 'mound shading is drawn');
  const skier = ctx.rects.findIndex((r) => r.color === '#2a50c0');
  assert.ok(skier > first, 'the skier is drawn after the mounds');
});
