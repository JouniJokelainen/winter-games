import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COURSE } from '../../../game/events/slalom/course.js';
import { renderSlalom, SKIER_SPRITES, skierPose } from '../../../game/events/slalom/slalomRender.js';
import { createSlalomState } from '../../../game/events/slalom/slalomSim.js';

function recordingCtx() {
  const rects = [];
  return {
    rects,
    fillStyle: null,
    fillRect(x, y, w, h) {
      for (const value of [x, y, w, h]) {
        if (!Number.isFinite(value)) throw new Error(`non-finite rect value ${value}`);
      }
      rects.push({ x, y, w, h, color: this.fillStyle });
    },
  };
}

test('skier sprites are 16 rows of 12 known pixel codes', () => {
  for (const [pose, rows] of Object.entries(SKIER_SPRITES)) {
    assert.equal(rows.length, 16, pose);
    for (const row of rows) assert.match(row, /^[.hgsjpk]{12}$/, pose);
  }
});

test('skierPose follows angle and phase', () => {
  const state = createSlalomState(COURSE);
  assert.equal(skierPose(state), 'straight');
  assert.equal(skierPose({ ...state, angle: -0.4 }), 'left');
  assert.equal(skierPose({ ...state, angle: 0.4 }), 'right');
  assert.equal(skierPose({ ...state, phase: 'disqualified' }), 'fallen');
});

test('renders every phase without errors and draws the skier', () => {
  const base = createSlalomState(COURSE);
  base.poles[0] = { hit: true, result: 'passed' };
  base.poles[1] = { hit: false, result: 'missed' };
  const states = [
    base,
    { ...base, phase: 'running', y: 520, x: 200, angle: 0.3, speed: 150, time: 3.5 },
    { ...base, phase: 'finished', y: COURSE.finishY + 2, speed: 200, time: 30.12 },
    { ...base, phase: 'disqualified', reason: 'outOfBounds', y: 900, x: 59 },
  ];
  for (const state of states) {
    const ctx = recordingCtx();
    renderSlalom(ctx, { state, track: [{ x: 160, y: 10 }, { x: 161, y: 12 }], label: 'YRITYS 1/3', time: 0.2 });
    assert.ok(ctx.rects.length > 500, `${state.phase}: ${ctx.rects.length} rects`);
  }
});
