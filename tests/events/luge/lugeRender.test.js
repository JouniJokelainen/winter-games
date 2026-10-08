import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE } from '../../../game/engine/palette.js';
import { renderLuge } from '../../../game/events/luge/lugeRender.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

const RETRO_COLORS = [PALETTE.yellow, PALETTE.ice, PALETTE.blue, PALETTE.navy, PALETTE.pine, PALETTE.brown];
const BASE = { time: 12.34, speedKmh: 96, lateral: 0, phase: 'ride', turn: 3, label: 'YRITYS 1/3' };

const VIEWS = {
  push: { ...BASE, s: -3.4, phase: 'push', showRedLine: true, stride: 0.25, banner: 'NAPUTA VÄLILYÖNTIÄ!', speedKmh: 8 },
  ride: { ...BASE, s: 108 },
  crashed: { ...BASE, s: 662, lateral: -1, sparks: true, warning: true, limitKmh: 100, banner: 'HYLÄTTY' },
  finished: { ...BASE, s: 1050, phase: 'finished', banner: 'MAALI!' },
};

test('renders every phase in whole pixels without the old retro colours', () => {
  for (const [name, view] of Object.entries(VIEWS)) {
    const ctx = recordingCtx();
    renderLuge(ctx, view);
    assert.ok(ctx.rects.length > 2000, `${name}: ${ctx.rects.length} rects`);
    for (const r of ctx.rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${name} ${JSON.stringify(r)}`);
    const used = new Set(ctx.rects.map((r) => r.color));
    for (const color of RETRO_COLORS) assert.ok(!used.has(color), `${name} uses ${color}`);
  }
});

test('the speed bar reaches full width only at 200 km/h', () => {
  const bar = (kmh) => {
    const ctx = recordingCtx();
    renderLuge(ctx, { ...BASE, s: 108, speedKmh: kmh });
    return ctx.rects.filter((r) => r.color === PALETTE.paper && r.x === 120 && r.y === 26 && r.h === 10).map((r) => r.w);
  };
  assert.deepEqual(bar(100), [75]);
  assert.deepEqual(bar(200), [150]);
});

test('the racing line is drawn in orange dashes only when asked for', () => {
  const orange = (view) => {
    const ctx = recordingCtx();
    renderLuge(ctx, view);
    for (const r of ctx.rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), JSON.stringify(r));
    return ctx.rects.filter((r) => r.color === PALETTE.orange).length;
  };
  const view = { ...BASE, s: 120 }; // inside the first turn
  assert.ok(orange({ ...view, showLine: true }) > orange(view) + 20);
});

test('the runner, the hop and the lean draw whole pixels without the retro colours', () => {
  const frames = [];
  for (const stride of [0, 0.25, 0.5, 0.75]) {
    for (const speedKmh of [0, 28]) frames.push({ ...VIEWS.push, stride, speedKmh });
  }
  for (const hop of [0, 0.25, 0.5, 0.75, 1]) frames.push({ ...BASE, s: 20 - 3.4, hop, curve: 0 });
  for (const curve of [-1, 0, 1]) frames.push({ ...BASE, s: 108, curve, lateral: -0.4 * curve });
  for (const view of frames) {
    const ctx = recordingCtx();
    renderLuge(ctx, view);
    const name = JSON.stringify({ stride: view.stride, hop: view.hop, curve: view.curve });
    assert.ok(ctx.rects.length > 2000, `${name}: ${ctx.rects.length} rects`);
    for (const r of ctx.rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${name} ${JSON.stringify(r)}`);
    const used = new Set(ctx.rects.map((r) => r.color));
    for (const color of RETRO_COLORS) assert.ok(!used.has(color), `${name} uses ${color}`);
  }
});

test('the hopping rider and the leaning rider differ from the plain lying rider', () => {
  const pixels = (view) => {
    const ctx = recordingCtx();
    renderLuge(ctx, view);
    return ctx.rects.map((r) => `${r.x},${r.y},${r.color}`).join('|');
  };
  const ride = { ...BASE, s: 60 };
  assert.notEqual(pixels({ ...ride, hop: 0.5 }), pixels(ride));
  assert.notEqual(pixels({ ...ride, curve: 1 }), pixels(ride));
  assert.equal(pixels({ ...ride, hop: 1 }), pixels(ride));
});

const redCount = (view) => {
  const ctx = recordingCtx();
  renderLuge(ctx, view);
  return ctx.rects.filter((r) => r.color === PALETTE.red).length;
};

test('the hop line is a wide red band that is drawn only while showRedLine is on', () => {
  const on = redCount(VIEWS.push);
  const off = redCount({ ...VIEWS.push, showRedLine: false });
  assert.ok(on > off + 60, `${on} vs ${off}`);
});

test('the start line is drawn across the ice behind the runner in the ready frame', () => {
  const paperRow = (view) => {
    const rows = new Map();
    const ctx = recordingCtx();
    renderLuge(ctx, view);
    for (const r of ctx.rects) if (r.color === PALETTE.paper && r.y > 400) rows.set(r.y, (rows.get(r.y) ?? 0) + r.w * r.h);
    return [...rows.values()].reduce((a, b) => a + b, 0);
  };
  assert.ok(paperRow({ ...VIEWS.push, showRedLine: false }) > 100);
  assert.equal(paperRow({ ...BASE, s: 300 }) > 100, false);
});

test('red flags stand at the hop line even when the line itself is hidden', () => {
  const near = redCount({ ...BASE, s: 20 - 18, phase: 'push', showRedLine: false });
  const far = redCount({ ...BASE, s: 300, phase: 'push', showRedLine: false });
  assert.ok(near > far + 10, `${near} vs ${far}`);
});

test('start barriers stand on both rims in the ready frame', () => {
  const wood = (view) => {
    const ctx = recordingCtx();
    renderLuge(ctx, view);
    return ctx.rects.filter((r) => r.color === PALETTE.concrete1 && r.y > 250 && (r.x < 160 || r.x > 480));
  };
  assert.ok(wood({ ...VIEWS.push, showRedLine: false }).length >= 2);
  assert.equal(wood({ ...BASE, s: 300 }).length, 0);
});

test('the start area frames draw whole pixels without the retro colours', () => {
  for (const s of [-3.4, 0, 4, 2, 17, 19.9, 24]) {
    for (const showRedLine of [true, false]) {
      const ctx = recordingCtx();
      renderLuge(ctx, { ...BASE, s, phase: 'push', showRedLine });
      for (const r of ctx.rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${s} ${JSON.stringify(r)}`);
      const used = new Set(ctx.rects.map((r) => r.color));
      for (const color of RETRO_COLORS) assert.ok(!used.has(color), `${s} uses ${color}`);
    }
  }
});

test('the sky is a smooth gradient, not a few flat bands', () => {
  const ctx = recordingCtx();
  renderLuge(ctx, { ...BASE, s: 60 });
  const colors = new Set(ctx.rects.filter((r) => r.y < 150 && r.w >= 600).map((r) => r.color));
  assert.ok(colors.size > 12, `${colors.size} distinct full-width sky colours`);
});
