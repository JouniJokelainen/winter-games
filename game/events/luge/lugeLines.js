// Start line, hop band and finish checker on the luge ice, drawn as a fine overlay per screen row.
// For every pixel of a row the cross-section projection is inverted (screen x -> trough position and
// distance along the track, interpolated between the projected samples of the pixel's top and bottom
// edges), so the lines follow the U of the trough exactly; partly covered pixels get translucent fills.
import { PALETTE } from '../../engine/palette.js';
import { BANK_H, CAM_H, FOCAL, HALF_W, HORIZON, MAX_Z, profileHeight, RIM_H, sample, W } from './lugeProjection.js';
import { FINISH_S, RED_LINE_S } from './lugeTrack.js';

const START_LINE_S = -0.9; // white start line: just behind the runner, near the bottom of the ready frame
const START_HALF = 0.04; // metres: an 8 cm white line
const HOP_BAND_HALF = 0.45; // metres; grows with distance so the band stays a few pixels thick far away
const CHECKER = 0.4; // finish checker square, metres
const MIN_ROW_PX = 2.2; // a far checker row stays at least this many pixels deep at the bottom of the trough
const SUB = 4; // sub-samples per pixel side for partly covered pixels
export const SAMPLES = 24; // cross-section steps across the trough; lugeRender's SAMPLE_XS uses the same count
const ICE_XS = Array.from({ length: SAMPLES + 1 }, (_, i) => -HALF_W + (i * 2 * HALF_W) / SAMPLES);
const PX_PER_M = CAM_H * FOCAL; // screen px per metre along the track at the trough bottom is PX_PER_M / z²

const BLACK = 0;
const PAPER = 1;
const RED = 2;
const BASE_COLORS = [PALETTE.black, PALETTE.paper, PALETTE.red];

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexOf = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// Line descriptions: `lo`..`hi` is the stretch along the track the line covers, `breaks` the along positions
// where its colour changes, `cell` the across size of a checker square (0: no squares).
function startLine(z) {
  const half = Math.max(START_HALF, (z * z) / PX_PER_M); // at least 2 px deep
  return { z, lo: START_LINE_S - half, hi: START_LINE_S + half, breaks: [], cell: 0, at: () => PAPER };
}

function hopLine(z) {
  const half = Math.max(HOP_BAND_HALF, 0.08 * z);
  const edge = Math.max(0.08, 0.016 * z);
  const core = half - edge;
  return {
    z,
    lo: RED_LINE_S - half - edge,
    hi: RED_LINE_S + half + edge,
    breaks: [RED_LINE_S - core, RED_LINE_S + core],
    cell: 0,
    at: (along) => (Math.abs(along - RED_LINE_S) < core ? RED : PAPER),
  };
}

function finishLine(z) {
  const depth = Math.max(CHECKER, (MIN_ROW_PX * z * z) / PX_PER_M);
  return {
    z,
    lo: FINISH_S - depth,
    hi: FINISH_S + depth,
    breaks: [FINISH_S],
    cell: CHECKER,
    at: (along, arc) => ((Math.floor(arc / CHECKER) + (along < FINISH_S ? 0 : 1)) & 1 ? PAPER : BLACK),
  };
}

// The cross-section of the trough for a bank: sample heights and arc lengths (they do not depend on the row).
function makeSection() {
  return { bank: NaN, h: new Float64Array(SAMPLES + 1), arc: new Float64Array(SAMPLES + 1) };
}

function shapeSection(section, bank) {
  if (section.bank === bank) return;
  section.bank = bank;
  const { h, arc } = section;
  for (let i = 0; i <= SAMPLES; i++) {
    h[i] = profileHeight(ICE_XS[i], bank);
    arc[i] = i === 0 ? 0 : arc[i - 1] + Math.hypot(ICE_XS[i] - ICE_XS[i - 1], h[i] - h[i - 1]);
  }
  const mid = arc[SAMPLES / 2];
  for (let i = 0; i <= SAMPLES; i++) arc[i] -= mid;
}

// One edge of a pixel row (screen y = HORIZON + dy): the projected cross-section samples with their screen x,
// distance along the track and arc length across the trough (from the centre line, along the surface).
function makeEdge(section) {
  return {
    dy: NaN,
    bank: NaN,
    sx: new Float64Array(SAMPLES + 1),
    along: new Float64Array(SAMPLES + 1),
    arc: section.arc,
    cAlong: new Float64Array(W + 2), // per pixel corner (screen x = px - 0.5), indexed from the row's left column
    cArc: new Float64Array(W + 2),
  };
}

function projectEdge(edge, section, dy, s, look) {
  if (edge.dy === dy && edge.bank === section.bank) return;
  edge.dy = dy;
  edge.bank = section.bank;
  const { sx, along } = edge;
  for (let i = 0; i <= SAMPLES; i++) {
    const z = ((CAM_H - section.h[i]) * FOCAL) / dy;
    sx[i] = W / 2 + (sample(look.L, z) + ICE_XS[i]) * (FOCAL / z);
    along[i] = s + z;
  }
}

// Inverts the projection for the corners k0..k1 (corner k at screen x = first + k - 0.5): interpolates between
// the samples whose screen x enclose it. Later segments overwrite earlier ones, as the ice spans do; corners
// beyond the end samples take their values.
function fillCorners(edge, first, k0, k1) {
  const { sx, along, arc, cAlong, cArc } = edge;
  for (let k = k0; k <= k1; k++) {
    const x = first + k - 0.5;
    const end = x <= sx[0] ? 0 : x >= sx[SAMPLES] ? SAMPLES : -1;
    cAlong[k] = end < 0 ? NaN : along[end];
    cArc[k] = end < 0 ? 0 : arc[end];
  }
  for (let i = 0; i < SAMPLES; i++) {
    const a = sx[i];
    const b = sx[i + 1];
    if (b <= a) continue;
    const from = Math.max(k0, Math.ceil(a - first + 0.5));
    const to = Math.min(k1, Math.ceil(b - first + 0.5) - 1);
    for (let k = from; k <= to; k++) {
      const t = (first + k - 0.5 - a) / (b - a);
      cAlong[k] = along[i] + (along[i + 1] - along[i]) * t;
      cArc[k] = arc[i] + (arc[i + 1] - arc[i]) * t;
    }
  }
}

// Colour strings for a pixel's coverage: the sub-sample counts per colour, cached per line tint.
const MAX_COLOR_CACHES = 512;
const colorCaches = new Map();
function colorCache(tinted) {
  const key = tinted.join('');
  let cache = colorCaches.get(key);
  if (cache === undefined) {
    if (colorCaches.size >= MAX_COLOR_CACHES) colorCaches.clear(); // keep the module-global cache bounded
    cache = new Map();
    colorCaches.set(key, cache);
  }
  return cache;
}

function pixelColor(line, c0, c1, c2) {
  const key = c0 + 17 * c1 + 289 * c2;
  let color = line.colors.get(key);
  if (color === undefined) {
    const counts = [c0, c1, c2];
    const total = c0 + c1 + c2;
    const full = SUB * SUB;
    const only = counts.indexOf(total);
    if (total === full && only >= 0) color = line.tinted[only];
    else {
      const c = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        if (counts[k] === 0) continue;
        const part = rgbOf(line.tinted[k]);
        for (let j = 0; j < 3; j++) c[j] += (part[j] * counts[k]) / total;
      }
      color = total === full ? hexOf(c) : `rgba(${c.map(Math.round).join(', ')}, ${(total / full).toFixed(3)})`;
    }
    line.colors.set(key, color);
  }
  return color;
}

// Sub-sample counts of a pixel for one line, from the along / arc values at its four corners.
const counts = [0, 0, 0];
function cover(line, a0, a1, a2, a3, r0, r1, r2, r3) {
  counts[0] = 0;
  counts[1] = 0;
  counts[2] = 0;
  const lo = Math.min(a0, a1, a2, a3);
  const hi = Math.max(a0, a1, a2, a3);
  let inside = lo >= line.lo && hi < line.hi;
  for (const b of line.breaks) if (lo < b && hi >= b) inside = false;
  if (inside && line.cell > 0) inside = Math.floor(Math.min(r0, r1, r2, r3) / line.cell) === Math.floor(Math.max(r0, r1, r2, r3) / line.cell);
  if (inside) {
    counts[line.at((lo + hi) / 2, (r0 + r1 + r2 + r3) / 4)] = SUB * SUB;
    return;
  }
  for (let j = 0; j < SUB; j++) {
    const v = (j + 0.5) / SUB;
    const aL = a0 + (a2 - a0) * v;
    const aR = a1 + (a3 - a1) * v;
    const rL = r0 + (r2 - r0) * v;
    const rR = r1 + (r3 - r1) * v;
    for (let i = 0; i < SUB; i++) {
      const u = (i + 0.5) / SUB;
      const along = aL + (aR - aL) * u;
      if (along >= line.lo && along < line.hi) counts[line.at(along, rL + (rR - rL) * u)] += 1;
    }
  }
}

// The lines visible in a frame. `tint(color, z)` fogs a colour like the ice at distance z.
// Returns null when no line is on screen; otherwise an object whose `row` gives the runs of one screen row.
export function lineOverlay(s, look, { showRedLine, tint }) {
  const lines = [];
  const startZ = START_LINE_S - s;
  if (startZ > 2.3 && startZ < MAX_Z - 2) lines.push(startLine(startZ));
  const hopZ = RED_LINE_S - s;
  if (showRedLine && hopZ > 0 && hopZ < MAX_Z - 2) lines.push(hopLine(hopZ));
  const finishZ = FINISH_S - s;
  if (finishZ > 0 && finishZ < MAX_Z - 2) lines.push(finishLine(finishZ));
  if (lines.length === 0) return null;
  for (const line of lines) {
    line.tinted = BASE_COLORS.map((color) => tint(color, line.z));
    line.colors = colorCache(line.tinted);
  }
  const section = makeSection();
  let top = makeEdge(section);
  let bottom = makeEdge(section);
  const spans = [];
  const meets = (active, lo, hi) => {
    for (const line of active) if (hi > line.lo && lo < line.hi) return true;
    return false;
  };

  // Runs of one screen row between the pixel columns `left` and `right` (inclusive): [{ x, w, color, solid }].
  function row(y, iceLeft, iceRight, bank) {
    const dy = y - HORIZON;
    const left = Math.max(0, iceLeft);
    const right = Math.min(W - 1, iceRight);
    if (right < left) return null;
    // Distances this row can show: from the highest rim to the lowest point of a banked trough.
    const zNear = ((CAM_H - RIM_H - BANK_H) * FOCAL) / (dy + 0.5);
    const zFar = ((CAM_H + BANK_H) * FOCAL) / (dy - 0.5);
    const active = lines.filter((line) => line.hi - s > zNear && line.lo - s < zFar);
    if (active.length === 0) return null;
    shapeSection(section, bank);
    // The bottom edge of the previous row is the top edge of this one.
    if (bottom.dy === dy - 0.5 && bottom.bank === bank) [top, bottom] = [bottom, top];
    projectEdge(top, section, dy - 0.5, s, look);
    projectEdge(bottom, section, dy + 0.5, s, look);
    // Pixel spans of the cross-section segments that can meet a line (both edges of the row considered).
    spans.length = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const lo = Math.min(top.along[i], top.along[i + 1], bottom.along[i], bottom.along[i + 1]);
      const hi = Math.max(top.along[i], top.along[i + 1], bottom.along[i], bottom.along[i + 1]);
      if (!meets(active, lo, hi)) continue;
      const from = i === 0 ? left : Math.max(left, Math.floor(Math.min(top.sx[i], bottom.sx[i])) - 1);
      const to = i === SAMPLES - 1 ? right : Math.min(right, Math.ceil(Math.max(top.sx[i + 1], bottom.sx[i + 1])) + 1);
      if (to >= from) spans.push([from, to]);
    }
    if (spans.length === 0) return null;
    // Sorted and merged, so that no pixel is visited twice.
    spans.sort((p, q) => p[0] - q[0]);
    let n = 0;
    for (const span of spans) {
      if (n > 0 && span[0] <= spans[n - 1][1] + 1) spans[n - 1][1] = Math.max(spans[n - 1][1], span[1]);
      else spans[n++] = span;
    }
    spans.length = n;
    const runs = [];
    for (const [from, to] of spans) {
      const k0 = from - left;
      const k1 = to - left + 1;
      fillCorners(top, left, k0, k1);
      fillCorners(bottom, left, k0, k1);
      let run = null;
      for (let k = k0; k < k1; k++) {
        const a0 = top.cAlong[k];
        const a1 = top.cAlong[k + 1];
        const a2 = bottom.cAlong[k];
        const a3 = bottom.cAlong[k + 1];
        let color = null;
        for (const line of active) {
          if (!(Math.max(a0, a1, a2, a3) > line.lo && Math.min(a0, a1, a2, a3) < line.hi)) continue;
          cover(line, a0, a1, a2, a3, top.cArc[k], top.cArc[k + 1], bottom.cArc[k], bottom.cArc[k + 1]);
          if (counts[0] + counts[1] + counts[2] > 0) color = pixelColor(line, counts[0], counts[1], counts[2]);
        }
        const x = left + k;
        if (color === null) run = null;
        else if (run && color === run.color && run.x + run.w === x) run.w += 1;
        else {
          run = { x, w: 1, color, solid: color[0] === '#' };
          runs.push(run);
        }
      }
    }
    return runs.length > 0 ? runs : null;
  }

  return { row };
}

// True when an opaque run of the row covers pixel column x.
export function runsCover(runs, x) {
  if (runs === null) return false;
  return runs.some((r) => r.solid && r.x <= x && r.x + r.w > x);
}

export function paintRuns(ctx, y, runs) {
  if (runs === null) return;
  for (const r of runs) {
    ctx.fillStyle = r.color;
    ctx.fillRect(r.x, y, r.w, 1);
  }
}
