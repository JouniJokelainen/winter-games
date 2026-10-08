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
