import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE } from '../../../game/engine/palette.js';
import { renderLuge } from '../../../game/events/luge/lugeRender.js';
import { PixelSurface } from '../../helpers/pixelSurface.js';
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

const redArea = (view) => {
  const ctx = recordingCtx();
  renderLuge(ctx, view);
  return ctx.rects.filter((r) => r.color === PALETTE.red).reduce((sum, r) => sum + r.w * r.h, 0);
};

test('the hop line is a wide red band that is drawn only while showRedLine is on', () => {
  const on = redArea(VIEWS.push);
  const off = redArea({ ...VIEWS.push, showRedLine: false });
  assert.ok(on > off + 150, `${on} vs ${off} red pixels`); // 23 m ahead: a band about 4 px deep across the ice
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

test('the icy lip and the shaded inner wall show in the straight', () => {
  const rects = render({ ...BASE, s: 60 });
  const rows = rects.filter((r) => r.y > 250 && r.y < 500);
  // Lip highlight: thin white rects on both rims.
  const highlight = (side) => rows.filter((r) => r.color === PALETTE.white && r.h === 1 && r.w <= 2 && side(r.x)).length;
  assert.ok(highlight((x) => x < 200) > 100, 'left lip highlight');
  assert.ok(highlight((x) => x > 440) > 100, 'right lip highlight');
  // Inner wall: dark cool wall tones (several px wide) beside the rims.
  const wall = rows.filter((r) => r.w >= 2 && (r.x + r.w < 200 || r.x > 440) && typeof r.color === 'string' && lum(r.color) < 105);
  assert.ok(wall.length > 100, `${wall.length} dark wall rects`);
});

test('the padding-heavy frames draw whole pixels without the retro colours', () => {
  for (const view of [{ s: 662, lateral: -0.5 }, { s: 412 }, { s: 662, lateral: 1.3, sparks: true }, { s: 288 }, { s: 500 }]) {
    const rects = render({ ...BASE, ...view });
    for (const r of rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${JSON.stringify(view)} ${JSON.stringify(r)}`);
    const used = new Set(rects.map((r) => r.color));
    for (const color of RETRO_COLORS) assert.ok(!used.has(color), `${JSON.stringify(view)} uses ${color}`);
  }
});

// ---- smooth start, hop and finish lines ----------------------------------------------------------

const LIP_SHADOW = '#4a546c'; // the 1 px dark line just inside each lip, on the wall side
// Per screen row: the x of the lip shadow pixels; the ice (where lines may be drawn) lies strictly between them.
const lipsByRow = (rects) => {
  const lips = new Map();
  for (const r of rects) {
    if (r.color !== LIP_SHADOW || r.w !== 1 || r.h !== 1) continue;
    const row = lips.get(r.y) ?? {};
    if (r.x < 320) row.left = r.x;
    else row.right = r.x;
    lips.set(r.y, row);
  }
  return lips;
};
const rgbaOf = (color) => {
  if (typeof color !== 'string') return null;
  if (color.startsWith('#')) return [...rgb(color), 1];
  const m = color.match(/^rgba\((\d+), *(\d+), *(\d+), *([\d.]+)\)$/);
  return m ? m.slice(1).map(Number) : null;
};
// Black, paper and their blends (neutral greys, opaque or translucent): the finish checker colours.
const isCheckerColor = (color) => {
  const c = rgbaOf(color);
  return c !== null && Math.abs(c[0] - c[1]) <= 8 && Math.abs(c[1] - c[2]) <= 8 && Math.abs(c[0] - c[2]) <= 12;
};
// Rects strictly between the lips of their row (single-row rects only).
const onIce = (rects, lips) => rects.filter((r) => {
  const lip = lips.get(r.y);
  return r.h === 1 && lip && lip.left !== undefined && lip.right !== undefined && r.x > lip.left && r.x + r.w <= lip.right;
});

test('the finish checker is one connected strip from lip to lip', () => {
  const rects = render({ ...BASE, s: 1046 });
  const lips = lipsByRow(rects);
  const marks = onIce(rects, lips).filter((r) => r.y > 200 && r.y < 300 && isCheckerColor(r.color));
  const pixels = new Set();
  for (const r of marks) for (let x = r.x; x < r.x + r.w; x++) pixels.add(`${x},${r.y}`);
  assert.ok(pixels.size > 200, `${pixels.size} checker pixels`);
  // 8-connected components of the checker pixels.
  const seen = new Set();
  let largest = [];
  for (const start of pixels) {
    if (seen.has(start)) continue;
    const component = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const key = stack.pop();
      component.push(key);
      const [x, y] = key.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const next = `${x + dx},${y + dy}`;
          if (pixels.has(next) && !seen.has(next)) {
            seen.add(next);
            stack.push(next);
          }
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  assert.ok(largest.length >= pixels.size * 0.97, `largest piece ${largest.length} of ${pixels.size} pixels`);
  const points = largest.map((key) => key.split(',').map(Number));
  assert.ok(points.some(([x, y]) => x <= lips.get(y).left + 4), 'the strip reaches the left lip');
  assert.ok(points.some(([x, y]) => x >= lips.get(y).right - 4), 'the strip reaches the right lip');
});

test('the lines have soft translucent edge pixels', () => {
  const cases = [
    { name: 'hop', view: { ...BASE, s: 14, phase: 'push', showRedLine: true }, line: (r) => r.color === PALETTE.red },
    { name: 'start', view: { ...BASE, s: -3.4, phase: 'push', showRedLine: false }, line: (r) => r.color === PALETTE.paper && r.y > 300 && (r.x + r.w < 250 || r.x > 390) },
    { name: 'finish', view: { ...BASE, s: 1046 }, line: (r) => r.color === PALETTE.black },
  ];
  for (const { name, view, line } of cases) {
    const rects = render(view);
    const ice = onIce(rects, lipsByRow(rects));
    const rows = new Set(ice.filter(line).map((r) => r.y));
    const soft = new Set(ice.filter((r) => rows.has(r.y) && String(r.color).startsWith('rgba(')).map((r) => r.y));
    assert.ok(rows.size >= 3, `${name}: ${rows.size} line rows`);
    assert.ok(soft.size >= rows.size * 0.8, `${name}: ${soft.size} of ${rows.size} line rows have translucent edge pixels`);
  }
});

test('the hop band edge is a smooth curve, not segment stair steps', () => {
  const rects = render({ ...BASE, s: 14, phase: 'push', showRedLine: true });
  const lips = lipsByRow(rects);
  // Leftmost opaque band pixel per row on the left half of the ice.
  const left = new Map();
  for (const r of onIce(rects, lips)) {
    if ((r.color !== PALETTE.red && r.color !== PALETTE.paper) || r.x >= 300) continue;
    left.set(r.y, Math.min(left.get(r.y) ?? Infinity, r.x));
  }
  const rows = [...left.keys()].sort((a, b) => a - b);
  assert.ok(rows.length > 15, `${rows.length} band rows`);
  // Along the wall part of the band (the edge leaves the lip and has not yet flattened out at the bottom),
  // the per-row step of the edge changes gradually.
  const steps = [];
  for (let i = 1; i < rows.length; i++) if (rows[i] === rows[i - 1] + 1) steps.push(left.get(rows[i]) - left.get(rows[i - 1]));
  const wall = steps.filter((d) => Math.abs(d) <= 12);
  assert.ok(wall.length > 10, `${wall.length} wall steps`);
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(steps[i]) > 12 || Math.abs(steps[i - 1]) > 12) continue;
    assert.ok(Math.abs(steps[i] - steps[i - 1]) <= 3, `edge steps ${steps.join(',')}`);
  }
});

test('the ice, its wear lanes and the racing line do not paint over the lines', () => {
  const cases = [
    { view: { ...BASE, s: 1056, phase: 'finished', showLine: true }, mark: (c) => c === PALETTE.black || c === PALETTE.paper, line: isCheckerColor },
    { view: { ...BASE, s: 14, phase: 'push', showRedLine: true, showLine: true }, mark: (c) => c === PALETTE.red || c === PALETTE.paper, line: (c) => c === PALETTE.red || c === PALETTE.paper || String(c).startsWith('rgba(') },
  ];
  for (const { view, mark, line } of cases) {
    const rects = render(view);
    const ice = new Set(onIce(rects, lipsByRow(rects)).filter((r) => mark(r.color)));
    let checked = 0;
    rects.forEach((m, i) => {
      if (!ice.has(m)) return;
      checked += 1;
      // The middle pixel of an opaque line mark: the last fill of that pixel in its track row is a line colour
      // (the track row ends where the next row starts with its full-width snow fill).
      const x = m.x + Math.floor(m.w / 2);
      const covers = (r) => r.x <= x && r.x + r.w > x && r.y <= m.y && r.y + r.h > m.y;
      const end = rects.findIndex((r, j) => j > i && r.w === 640);
      const last = [m, ...rects.slice(i + 1, end === -1 ? undefined : end).filter(covers)].at(-1);
      assert.ok(line(last.color), `line pixel ${x},${m.y} ends as ${last.color}`);
    });
    assert.ok(checked >= 20, `${checked} line marks on the ice`);
  }
});

test('the line frames draw whole pixels, no retro colours and keep the rims free of the lines', () => {
  const frames = [
    { ...BASE, s: -3.4, phase: 'push', showRedLine: true, stride: 0.25 }, { ...BASE, s: 4, phase: 'push', showRedLine: true },
    { ...BASE, s: 2, phase: 'push', showRedLine: true }, { ...BASE, s: 10, phase: 'push', showRedLine: true },
    { ...BASE, s: 14, phase: 'push', showRedLine: true },
    ...[1000, 1030, 1045, 1046, 1054, 1058].map((s) => ({ ...BASE, s })), { ...BASE, s: 1056, phase: 'finished', banner: 'MAALI!' },
  ];
  for (const view of frames) {
    const rects = render(view);
    for (const r of rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${view.s} ${JSON.stringify(r)}`);
    const used = new Set(rects.map((r) => r.color));
    for (const color of RETRO_COLORS) assert.ok(!used.has(color), `${view.s} uses ${color}`);
    // No checker or hop colour on the lip of a row (from the lip shadow outwards across the lip, 3 px at least).
    const lips = lipsByRow(rects);
    const lineColor = (c) => c === PALETTE.black || c === PALETTE.paper || c === PALETTE.red || (String(c).startsWith('rgba(') && isCheckerColor(c));
    for (const r of rects) {
      const lip = lips.get(r.y);
      if (!lip || r.h !== 1 || !lineColor(r.color) || r.y < 200) continue;
      if (lip.left !== undefined) assert.ok(r.x + r.w <= lip.left - 3 || r.x > lip.left, `${view.s}: ${JSON.stringify(r)} on the left lip at ${lip.left}`);
      if (lip.right !== undefined) assert.ok(r.x >= lip.right + 4 || r.x + r.w <= lip.right, `${view.s}: ${JSON.stringify(r)} on the right lip at ${lip.right}`);
    }
  }
});

test('the sky is deterministic, slides with the heading and drifts with the clock', async () => {
  const { drawLugeSky } = await import('../../../game/events/luge/lugeSky.js');
  const { HORIZON } = await import('../../../game/events/luge/lugeProjection.js');
  const sky = (heading, clock) => {
    const ctx = recordingCtx();
    drawLugeSky(ctx, { heading, clock, horizon: HORIZON }, () => {});
    return JSON.stringify(ctx.rects);
  };
  assert.equal(sky(0.3, 5), sky(0.3, 5));
  assert.notEqual(sky(0.3, 5), sky(1.3, 5));
  assert.notEqual(sky(0.3, 5), sky(0.3, 25));
  assert.equal(sky(0.3, undefined), sky(0.3, 0));
});

// ---- smooth ice surface ---------------------------------------------------------------------------

// A frame drawn the way the browser draws it (through the row buffer), without the snowflakes (white specks
// drawn on top of everything); `direct` draws it rect by rect instead.
function bufferedFrame(view, { direct = false } = {}) {
  const surface = new PixelSurface(640, 512);
  if (direct) surface.putImageData = undefined;
  const fill = surface.fillRect.bind(surface);
  surface.fillRect = function fillRect(x, y, w, h) {
    if (!direct && this.fillStyle === PALETTE.white && w <= 2 && h <= 2) return;
    fill(x, y, w, h);
  };
  renderLuge(surface, view);
  return surface;
}
const pixelAt = (surface, x, y) => {
  const i = (y * surface.width + x) * 4;
  return [surface.px[i], surface.px[i + 1], surface.px[i + 2]].map(Math.round);
};
function pixelLum(surface, x, y) {
  const [r, g, b] = pixelAt(surface, x, y);
  return 0.3 * r + 0.59 * g + 0.11 * b;
}
const pixelDiff = (surface, x0, y0, x1, y1) => {
  const a = pixelAt(surface, x0, y0);
  const b = pixelAt(surface, x1, y1);
  return Math.max(...[0, 1, 2].map((k) => Math.abs(a[k] - b[k])));
};
const SMOOTH_VIEWS = [{ ...BASE, s: 60 }, { ...BASE, s: 108, curve: 1 }, { ...BASE, s: 662, lateral: -0.5 }, { ...BASE, s: 412 }];

test('the ice is a smooth gradient across the trough, without segment steps', () => {
  for (const view of SMOOTH_VIEWS) {
    const p = bufferedFrame(view);
    const lips = lipsByRow(render(view));
    for (const y of [440, 470, 500]) {
      const lip = lips.get(y) ?? {};
      let worst = 0;
      let at = -1;
      for (let x = Math.max(1, (lip.left ?? -1) + 4); x < Math.min(640, (lip.right ?? 640) - 3); x++) {
        const d = pixelDiff(p, x, y, x - 1, y);
        if (d > worst) [worst, at] = [d, x];
      }
      assert.ok(worst <= 7, `s=${view.s} row ${y}: a step of ${worst} at x=${at}`); // segment steps were up to 12 (43 at a groove)
    }
  }
});

test('the ice carries a faint texture: many tones, only small deviations from the local shade', () => {
  for (const view of SMOOTH_VIEWS) {
    const p = bufferedFrame(view);
    const tones = new Set();
    let worst = 0;
    for (let y = 440; y < 512; y++) {
      for (let x = 8; x < 632; x++) {
        tones.add(pixelAt(p, x, y).join());
        let sum = 0;
        for (let k = -6; k <= 6; k++) sum += pixelLum(p, x + k, y);
        worst = Math.max(worst, Math.abs(pixelLum(p, x, y) - sum / 13));
      }
    }
    assert.ok(tones.size > 300, `s=${view.s}: ${tones.size} tones near the sled`); // flat segments: about 20
    assert.ok(worst <= 9, `s=${view.s}: a pixel ${worst.toFixed(1)} off its local shade`);
  }
});

test('the ice texture is deterministic and sticks to the track', () => {
  const a = bufferedFrame({ ...BASE, s: 24 });
  assert.equal(a.differing(bufferedFrame({ ...BASE, s: 24 })), 0);
  // 20 m further on the same straight: one texture period and two band periods, so the near track looks the same.
  const b = bufferedFrame({ ...BASE, s: 44 });
  let differ = 0;
  for (let y = 440; y < 512; y++) for (let x = 0; x < 640; x++) if (pixelAt(a, x, y).join() !== pixelAt(b, x, y).join()) differ += 1;
  assert.equal(differ, 0, `${differ} near pixels differ`);
  // Half a metre on: the texture moves with the track, so the near rows change.
  const c = bufferedFrame({ ...BASE, s: 24.5 });
  let moved = 0;
  for (let y = 440; y < 512; y++) for (let x = 0; x < 640; x++) if (pixelAt(a, x, y).join() !== pixelAt(c, x, y).join()) moved += 1;
  assert.ok(moved > 5000, `${moved} near pixels changed`);
});

test('no hairline groove runs along the ice: no groove colour and no 1 px dark run in the straight', () => {
  const view = { ...BASE, s: 60 };
  assert.equal(render(view).filter((r) => r.color === PALETTE.trackGroove).length, 0, 'groove rects');
  const p = bufferedFrame(view);
  const lips = lipsByRow(render(view));
  let dips = 0;
  for (let y = 250; y < 512; y++) {
    const lip = lips.get(y) ?? {};
    for (let x = Math.max(1, (lip.left ?? -1) + 4); x < Math.min(639, (lip.right ?? 640) - 4); x++) {
      if (y > 290 && y < 432 && x > 250 && x < 390) continue; // the rider
      const here = pixelLum(p, x, y);
      if (here < Math.min(pixelLum(p, x - 1, y), pixelLum(p, x + 1, y)) - 6) dips += 1;
    }
  }
  assert.equal(dips, 0, `${dips} pixels darker than both neighbours`);
});

test('the runner paths show as wide, dim wear lanes', async () => {
  const { CAM_H, FOCAL, HORIZON, lookahead, profileHeight, sample } = await import('../../../game/events/luge/lugeProjection.js');
  const view = { ...BASE, s: 60 };
  const p = bufferedFrame(view);
  const look = lookahead(view.s);
  const screenX = (x, y) => {
    const z = ((CAM_H - profileHeight(x, 0)) * FOCAL) / (y - HORIZON);
    return Math.round(320 + (sample(look.L, z) + x) * (FOCAL / z));
  };
  // Mean luminance of a short vertical strip (averages the texture out).
  const strip = (x) => {
    let sum = 0;
    for (let y = 450; y < 510; y++) sum += pixelLum(p, screenX(x, y), y);
    return sum / 60;
  };
  for (const side of [-1, 1]) {
    const lane = strip(side * 0.9);
    const between = (strip(side * 0.55) + strip(side * 1.25)) / 2;
    const contrast = between - lane;
    assert.ok(contrast >= 1.5 && contrast <= 10, `side ${side}: lane ${lane.toFixed(1)} vs ${between.toFixed(1)}`);
  }
});

test('the surface frames of the plan draw whole pixels without the retro colours on either path', () => {
  const frames = [
    { ...BASE, s: -3.4, phase: 'push', showRedLine: true, stride: 0.25 }, { ...BASE, s: 60 }, { ...BASE, s: 108, curve: 1 },
    { ...BASE, s: 662, lateral: -0.5 }, { ...BASE, s: 412 }, { ...BASE, s: 560 }, { ...BASE, s: 1000 },
    { ...BASE, s: 1056, phase: 'finished', banner: 'MAALI!' }, { ...BASE, s: 662, lateral: 1.3, sparks: true },
  ];
  const retro = new Set(RETRO_COLORS.map((c) => rgb(c).join()));
  for (const view of frames) {
    const rects = render(view);
    for (const r of rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${view.s} ${JSON.stringify(r)}`);
    const used = new Set(rects.map((r) => r.color));
    for (const color of RETRO_COLORS) assert.ok(!used.has(color), `${view.s} uses ${color}`);
    const p = bufferedFrame(view);
    for (let y = 197; y < 512; y++) for (let x = 0; x < 640; x++) assert.ok(!retro.has(pixelAt(p, x, y).join()), `${view.s}: retro pixel at ${x},${y}`);
  }
});
