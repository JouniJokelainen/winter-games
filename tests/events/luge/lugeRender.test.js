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

const isGreen = (color) => {
  if (typeof color !== 'string' || !color.startsWith('#')) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  return g > r + 6 && g > b + 6 && g < 120;
};

test('the forest has several tones and no single huge tree', () => {
  const ctx = recordingCtx();
  renderLuge(ctx, { ...BASE, s: 60 });
  const green = ctx.rects.filter((r) => isGreen(r.color) && r.y >= 44 && r.y < 330);
  const trunks = ctx.rects.filter((r) => r.color === PALETTE.trunk || r.color === PALETTE.wood8);
  const tones = new Set(green.map((r) => r.color));
  assert.ok(tones.size >= 4, `${tones.size} distinct dark-green tones`);
  // No single tree (a connected vertical run of crown and trunk pixels in one column) may reach 200 px.
  const columns = new Map();
  for (const r of [...green, ...trunks]) {
    for (let x = Math.max(0, r.x); x < Math.min(640, r.x + r.w); x++) {
      if (!columns.has(x)) columns.set(x, []);
      columns.get(x).push([r.y, r.y + r.h]);
    }
  }
  for (const [x, spans] of columns) {
    spans.sort((p, q) => p[0] - q[0]);
    let start = spans[0][0];
    let end = spans[0][1];
    for (const [y0, y1] of spans.slice(1).concat([[9999, 9999]])) {
      if (y0 <= end + 1) end = Math.max(end, y1);
      else {
        assert.ok(end - start < 200, `tree run at x=${x} spans ${end - start}px`);
        start = y0;
        end = y1;
      }
    }
  }
});

test('the forest is deterministic and stays off the track', () => {
  const shot = (view) => {
    const ctx = recordingCtx();
    renderLuge(ctx, view);
    return ctx.rects;
  };
  const view = { ...BASE, s: 300 };
  assert.deepEqual(shot(view), shot(view));
  // No tree-green pixel on the ice: the trough sits around the screen centre on the straight and in the turns.
  for (const [s, curve] of [[60, 0], [108, 1], [400, 0], [662, 1]]) {
    const ice = shot({ ...BASE, s, curve }).filter((r) => r.w >= 40 && r.y > 330 && r.y < 420 && !isGreen(r.color));
    assert.ok(ice.length > 0);
    for (const r of shot({ ...BASE, s, curve })) {
      if (isGreen(r.color) && r.y > 330 && r.y < 420) assert.ok(r.x > 340 || r.x + r.w < 300, `s=${s} green rect on the track ${JSON.stringify(r)}`);
    }
  }
});

// Venue: spectator outfits are drawn in these colours (fog tints them slightly, so compare with a tolerance).
// (the green outfit is left out: it is the colour of the trees)
const OUTFIT_COLORS = [PALETTE.suitPink, PALETTE.guide, PALETTE.wood2, PALETTE.red];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const OUTFIT_RGB = OUTFIT_COLORS.map(rgb);
const isOutfit = (color) => {
  if (typeof color !== 'string' || !color.startsWith('#')) return false;
  const c = rgb(color);
  return OUTFIT_RGB.some((o) => Math.hypot(c[0] - o[0], c[1] - o[1], c[2] - o[2]) < 24);
};
const outfitRects = (view) => {
  const ctx = recordingCtx();
  renderLuge(ctx, view);
  return ctx.rects.filter((r) => isOutfit(r.color) && r.y > 150 && r.y < 440);
};

test('the finish stands are full of spectators and the open straight has none', () => {
  const finish = outfitRects({ ...BASE, s: 1050, phase: 'finished' }).length;
  const straight = outfitRects({ ...BASE, s: 60 }).length;
  assert.ok(finish > straight + 100, `finish ${finish} vs straight ${straight} spectator rects`);
});

// Heads are the one spectator colour nothing else in the scene shares (skin; the rider is below y = 300).
const SKIN_RGB = rgb(PALETTE.skin);
const heads = (view) => {
  const ctx = recordingCtx();
  renderLuge(ctx, view);
  return ctx.rects.filter((r) => {
    if (typeof r.color !== 'string' || !r.color.startsWith('#') || r.y < 150 || r.y > 300) return false;
    const c = rgb(r.color);
    return Math.hypot(c[0] - SKIN_RGB[0], c[1] - SKIN_RGB[1], c[2] - SKIN_RGB[2]) < 20;
  });
};

test('the start stands are full of spectators in the ready frame', () => {
  const ready = heads({ ...BASE, s: -3.4, phase: 'push', showRedLine: true, stride: 0.25 });
  const straight = heads({ ...BASE, s: 60 });
  assert.equal(straight.length, 0);
  assert.ok(ready.length >= 40, `${ready.length} spectator heads`);
  assert.ok(ready.some((r) => r.x > 320) && ready.some((r) => r.x < 320), 'both sides of the start have spectators');
});

test('the spectators wave: two clock values change at least 20 spectator rects', () => {
  const key = (r) => `${r.x},${r.y},${r.w},${r.h},${r.color}`;
  for (const s of [1050, -3.4]) {
    const view = { ...BASE, s, phase: s < 0 ? 'push' : 'finished', stride: 0.25 };
    const a = new Set(outfitRects({ ...view, clock: 0 }).map(key));
    const b = new Set(outfitRects({ ...view, clock: 0.25 }).map(key));
    const changed = [...a].filter((k) => !b.has(k)).length + [...b].filter((k) => !a.has(k)).length;
    assert.ok(changed >= 20, `${s}: ${changed} changed spectator rects`);
  }
});

test('a small group of spectators stands on the outer side of turn 3', () => {
  const near = heads({ ...BASE, s: 288 });
  const past = heads({ ...BASE, s: 330 }); // the same turn, group behind the camera
  assert.equal(past.length, 0);
  assert.ok(near.length >= 5, `${near.length} heads`);
  assert.ok(near.every((r) => r.x + r.w / 2 < 320), 'the group stands on the outer (left) side');
});

test('the clock falls back to time and then to zero', () => {
  const shot = (view) => {
    const ctx = recordingCtx();
    renderLuge(ctx, { ...BASE, s: 1050, phase: 'finished', ...view });
    return ctx.rects;
  };
  assert.deepEqual(shot({ clock: undefined, time: 0.25 }), shot({ clock: 0.25, time: 0.25 }));
  assert.deepEqual(shot({ clock: undefined, time: undefined }), shot({ clock: 0, time: 0 }));
  assert.notDeepEqual(shot({ clock: 0 }), shot({ clock: 0.25 }));
});

test('the venue frames draw whole pixels without the retro colours', () => {
  for (const s of [-3.4, 12, 288, 330, 500, 625, 1000, 1050, 1070]) {
    const ctx = recordingCtx();
    renderLuge(ctx, { ...BASE, s, clock: s / 7 });
    for (const r of ctx.rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${s} ${JSON.stringify(r)}`);
    const used = new Set(ctx.rects.map((r) => r.color));
    for (const color of RETRO_COLORS) assert.ok(!used.has(color), `${s} uses ${color}`);
  }
});

const lum = (hex) => 0.3 * parseInt(hex.slice(1, 3), 16) + 0.59 * parseInt(hex.slice(3, 5), 16) + 0.11 * parseInt(hex.slice(5, 7), 16);
const render = (view) => {
  const ctx = recordingCtx();
  renderLuge(ctx, view);
  return ctx.rects;
};

// Padding is a dark blue-grey strip: any blue-dominant, darkish rect on the track rows beside the sled (fog-independent).
const isPadding = (r) => {
  const c = typeof r.color === 'string' && r.color[0] === '#' ? [1, 3, 5].map((i) => parseInt(r.color.slice(i, i + 2), 16)) : null;
  return c && r.y >= 215 && c[2] - c[0] >= 38 && c[2] < 200 && (r.x + r.w < 230 || r.x > 410);
};
const paddingSides = (view) => {
  const rects = render(view).filter(isPadding);
  return { left: rects.filter((r) => r.x + r.w < 230).length, right: rects.filter((r) => r.x > 410).length };
};

test('the padding runs on the outer side of every turn: left of a right turn, right of a left turn', () => {
  const hairpin = paddingSides({ ...BASE, s: 662, lateral: -0.5 }); // right turn
  const right = paddingSides({ ...BASE, s: 108 }); // right turn
  const left = paddingSides({ ...BASE, s: 412 }); // left turn
  assert.ok(hairpin.left > 150 && hairpin.right < hairpin.left / 10, `hairpin ${JSON.stringify(hairpin)}`);
  assert.ok(right.left > 100 && right.right < right.left / 10, `right turn ${JSON.stringify(right)}`);
  assert.ok(left.right > 100 && left.left < left.right / 10, `left turn ${JSON.stringify(left)}`);
});

test('the icy lip, the shaded inner wall and the sheen show in the straight', () => {
  const rects = render({ ...BASE, s: 60 });
  const rows = rects.filter((r) => r.y > 250 && r.y < 500);
  // Lip highlight: thin white rects on both rims.
  const highlight = (side) => rows.filter((r) => r.color === PALETTE.white && r.h === 1 && r.w <= 2 && side(r.x)).length;
  assert.ok(highlight((x) => x < 200) > 100, 'left lip highlight');
  assert.ok(highlight((x) => x > 440) > 100, 'right lip highlight');
  // Inner wall: dark cool wall tones (several px wide) beside the rims.
  const wall = rows.filter((r) => r.w >= 2 && (r.x + r.w < 200 || r.x > 440) && typeof r.color === 'string' && lum(r.color) < 105);
  assert.ok(wall.length > 100, `${wall.length} dark wall rects`);
  // Sheen: a wide faint tone and a lighter, narrower core are drawn right before each 1 px groove.
  let sheen = 0;
  rects.forEach((r, i) => {
    if (r.color !== PALETTE.trackGroove || r.w !== 1 || r.y < 400) return;
    const core = rects[i - 1];
    const faint = rects[i - 2];
    if (core.y === r.y && faint.y === r.y && faint.w > core.w && lum(core.color) > lum(faint.color)) sheen += 1;
  });
  assert.ok(sheen > 100, `${sheen} groove rows with a sheen`);
});

test('the padding-heavy frames draw whole pixels without the retro colours', () => {
  for (const view of [{ s: 662, lateral: -0.5 }, { s: 412 }, { s: 662, lateral: 1.3, sparks: true }, { s: 288 }, { s: 500 }]) {
    const rects = render({ ...BASE, ...view });
    for (const r of rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${JSON.stringify(view)} ${JSON.stringify(r)}`);
    const used = new Set(rects.map((r) => r.color));
    for (const color of RETRO_COLORS) assert.ok(!used.has(color), `${JSON.stringify(view)} uses ${color}`);
  }
});
