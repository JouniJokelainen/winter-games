// Luge scene renderer (art trial). Segment-style pseudo-3D drawn row by row from the horizon to the
// bottom of the 640×512 canvas: ice track, banked concrete walls, snow, trees, spectators and signs.
import { formatTime } from '../../core/format.js';
import { drawBlinking } from '../../engine/draw.js';
import { drawText } from '../../engine/font.js';
import { PALETTE } from '../../engine/palette.js';
import { createRng } from '../../engine/rng.js';
import { drawSnowfall } from '../../engine/scenery.js';
import { drawCachedBackdrop } from './lugeBackdrop.js';
import { createRowBuffer } from './lugeRowBuffer.js';
import { drawForestBackdrop, drawLugePine, forestObjects } from './lugeForest.js';
import { lineOverlay, paintRuns, runsCover, SAMPLES } from './lugeLines.js';
import { drawLugeSky } from './lugeSky.js';
import { BOARD_CLEARANCE, drawVenueObject, isVenueObject, venueObjects } from './lugeVenue.js';
import { drawRunner, drawSledAndRider, SLED_X_RANGE } from './lugeSled.js';
import {
  bankFor, CAM_H, FOCAL, H, HALF_W, HORIZON, lookahead, MAX_Z, profileHeight, profileSlope, project, sample, SLED_Z, W, WALL_T,
} from './lugeProjection.js';
import { FINISH_S, headingAt, racingLineAt, RED_LINE_S, TURNS } from './lugeTrack.js';

const HUD_HEIGHT = 44;
const TEXT_SCALE = 2;
const FOG_TARGET = PALETTE.mist3;
const FOG_START = 40;
const LINE_DASH = 1.5; // metres per dash and per gap
const LINE_WIDTH = 0.1; // metres
const FOG_SPAN = 150;
const RIM_X = HALF_W + WALL_T / 2; // centre of the rim cap
const BARRIER_S = -0.3; // start barriers on the rims, beside the sled

// Stretches where no near tree stands: the start area, the finish and the outer side of every turn (venue objects).
const FOREST_MARGINS = [
  { from: -50, to: 40, side: 0 },
  { from: FINISH_S - 40, to: FINISH_S + 40, side: 0 },
  ...TURNS.map((turn) => ({ from: turn.at - 20, to: turn.at + 20, side: turn.k > 0 ? -1 : 1 })),
  ...BOARD_CLEARANCE,
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Colour blend, memoised: the track asks for the same few thousand blends every frame. `t` is quantised to 1/32.
const mixCache = new Map();
const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

function mix(hexA, hexB, t) {
  if (t <= 0) return hexA;
  const step = Math.round(clamp(t, 0, 1) * 32);
  if (step === 0) return hexA;
  const key = `${hexA}${hexB}${step}`;
  let color = mixCache.get(key);
  if (color === undefined) {
    const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    const part = (i) => Math.round(channel(hexA, i) + ((channel(hexB, i) - channel(hexA, i)) * step) / 32);
    color = `#${HEX[part(0)]}${HEX[part(1)]}${HEX[part(2)]}`;
    mixCache.set(key, color);
  }
  return color;
}

function fillRow(ctx, x0, x1, y, color) {
  const left = Math.round(x0);
  const width = Math.round(x1) - left;
  if (width <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(left, y, width, 1);
}

const ICE_LIT = mix(PALETTE.trackIce, PALETTE.white, 0.45);
const ICE_DARK = mix(PALETTE.trackIce, PALETTE.concrete3, 0.6);
const RIM_COLOR = '#c6d8f0'; // icy top lip: a cool blue-white fill
const LIP_EDGE = PALETTE.white; // bright 1-2 px highlight on the inner edge of the lip
const LIP_SHADOW = '#4a546c'; // thin dark line right below the lip, where the wall starts
const LIP_MIN_W = 3; // minimum on-screen width of the lip (px), outline and highlight included
const WALL_SHADE = '#36405a'; // cool shadow deep in the walls
const ICE_FOG = mix(FOG_TARGET, PALETTE.white, 0.3); // the ice fades to a lighter mist than the snow: a faint sheen towards the horizon
const X_OUT = HALF_W + WALL_T;

// Padding on the outer side of a turn: a low dark-blue strip along the rim, outside the icy lip.
const PAD_FACE = '#3c4a6b';
const PAD_TOP_A = '#8195ba';
const PAD_TOP_B = '#63779e';
const PAD_EDGE = '#c3cfe3'; // lighter line along the top edge of the padding
const PAD_H = 0.6; // metres above the rim (capped just below the camera height where the rim is high)
const PAD_W = 0.7; // metres outwards from the rim
const PAD_MIN_BANK = 0.08; // the padding fades in from here to full height at PAD_MIN_BANK + 0.3

// Cross-section sample positions: the rim caps and SAMPLES steps across the trough.
const SAMPLE_XS = [-X_OUT, ...Array.from({ length: SAMPLES + 1 }, (_, i) => -HALF_W + (i * 2 * HALF_W) / SAMPLES), X_OUT];

// Ice colour from the slope of the surface (lit from the right, so the left wall is bright and the right wall
// dark) with a darker tone deep in the walls, plus alternating bands that give a feeling of speed.
const iceCache = new Map();
function iceColor(slope, depth, band) {
  const key = `${Math.round(slope * 20)}|${Math.round(depth * 12)}|${band}`;
  let cached = iceCache.get(key);
  if (cached === undefined) {
    cached = computeIce(slope, depth, band);
    iceCache.set(key, cached);
  }
  return cached;
}

// Soft sheen around a runner groove: two tones a little lighter than the local ice (wide and faint, then a core).
const sheenCache = new Map();
function sheenTones(ice) {
  let tones = sheenCache.get(ice);
  if (tones === undefined) {
    tones = [mix(ice, PALETTE.white, 0.07), mix(ice, PALETTE.white, 0.15)];
    sheenCache.set(ice, tones);
  }
  return tones;
}

function computeIce(slope, depth, band) {
  let color = mix(ICE_DARK, ICE_LIT, clamp(0.5 - 0.42 * slope, 0, 1));
  color = mix(color, PALETTE.skyLight, 0.12);
  color = mix(color, PALETTE.concrete3, 0.22 * depth);
  color = mix(color, WALL_SHADE, 0.85 * depth ** 2);
  if (band) color = mix(color, PALETTE.white, 0.07);
  return color;
}


// One screen row of the padding: the face towards the track, then the top. The outer rim is the higher one.
function drawPadding(ctx, look, bank, dy, s, y, rimSx) {
  const height = PAD_H * clamp((Math.abs(bank) - PAD_MIN_BANK) / 0.3, 0, 1);
  if (height < 0.05) return;
  const side = bank > 0 ? -1 : 1;
  const topH = Math.min(profileHeight(side * HALF_W, bank) + height, CAM_H - 0.04);
  const z = ((CAM_H - topH) * FOCAL) / dy;
  const m = FOCAL / z;
  const offset = sample(look.L, z);
  const faceSx = W / 2 + (offset + side * X_OUT) * m;
  const topSx = W / 2 + (offset + side * (X_OUT + PAD_W)) * m;
  const fog = clamp((z - FOG_START) / FOG_SPAN, 0, 1);
  const top = Math.floor((s + z) / 3) % 2 === 0 ? PAD_TOP_A : PAD_TOP_B;
  if (side > 0) {
    fillRow(ctx, rimSx, faceSx, y, mix(PAD_FACE, FOG_TARGET, fog));
    fillRow(ctx, faceSx, topSx, y, mix(top, FOG_TARGET, fog));
    fillRow(ctx, topSx - 1, topSx, y, mix(PAD_EDGE, FOG_TARGET, fog));
  } else {
    fillRow(ctx, topSx, faceSx, y, mix(top, FOG_TARGET, fog));
    fillRow(ctx, topSx, topSx + 1, y, mix(PAD_EDGE, FOG_TARGET, fog));
    fillRow(ctx, faceSx, rimSx, y, mix(PAD_FACE, FOG_TARGET, fog));
  }
}

// Inner edge column of a lip (rounded): at least LIP_MIN_W px in from the outer edge.
function lipInner(outerSx, innerSx, side) {
  const outer = Math.round(outerSx);
  return side < 0 ? Math.max(Math.round(innerSx), outer + LIP_MIN_W) : Math.min(Math.round(innerSx), outer - LIP_MIN_W);
}

// One side of the rim cap on a screen row: concrete outline outside, cool blue-white lip, a bright highlight on the
// inner edge and a thin dark line just inside on the wall. The lip is at least LIP_MIN_W px wide.
function drawLip(ctx, y, outerSx, innerSx, side, tint) {
  const outer = Math.round(outerSx);
  const inner = lipInner(outerSx, innerSx, side);
  const lo = Math.min(outer, inner);
  const hi = Math.max(outer, inner);
  const wide = hi - lo >= 5;
  if (hi - lo > Math.abs(Math.round(innerSx) - outer)) fillRow(ctx, lo, hi, y, tint(RIM_COLOR));
  ctx.fillStyle = tint(PALETTE.concrete2);
  ctx.fillRect(side < 0 ? lo : hi - 1, y, 1, 1);
  ctx.fillStyle = tint(LIP_EDGE);
  const edgeW = wide ? 2 : 1;
  ctx.fillRect(side < 0 ? hi - edgeW : lo, y, edgeW, 1);
  ctx.fillStyle = tint(LIP_SHADOW);
  ctx.fillRect(side < 0 ? hi : lo - 1, y, 1, 1);
}

// ---- backdrop -----------------------------------------------------------------------------------

const BACKDROP_TINT = (color, amount) => mix(color, FOG_TARGET, amount);
// Smallest and largest heading on the track (headingAt is piecewise linear between whole metres).
const HEADING_RANGE = (() => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let s = 0; s <= FINISH_S + 200; s += 1) {
    lo = Math.min(lo, headingAt(s));
    hi = Math.max(hi, headingAt(s));
  }
  return [lo, hi];
})();

// From the offscreen cache when a canvas can be made, otherwise drawn directly (tests, node).
function drawBackdrop(ctx, s, clock) {
  const heading = headingAt(s);
  if (drawCachedBackdrop(ctx, { heading, clock, horizon: HORIZON, tint: BACKDROP_TINT, headingRange: HEADING_RANGE })) return;
  drawLugeSky(ctx, { heading, clock, horizon: HORIZON }, () => {
    drawForestBackdrop(ctx, { heading, horizon: HORIZON, tint: BACKDROP_TINT });
  });
}

// ---- trackside objects --------------------------------------------------------------------------

function buildScenery(s) {
  const list = [];
  const first = Math.floor((s + 2) / 12);
  const last = Math.floor((s + MAX_Z) / 12);
  for (let i = first; i <= last; i++) {
    const along = i * 12;
    const edge = HALF_W + WALL_T;
    if (i % 3 === 1) list.push({ type: 'pole', along, x: edge + 0.9, height: 6 });
  }
  list.push(...venueObjects(s + 2, s + MAX_Z));
  list.push(...forestObjects(first, last, { edge: HALF_W + WALL_T, margins: FOREST_MARGINS }));
  for (const turn of TURNS) {
    const outer = turn.k > 0 ? -1 : 1;
    list.push({ type: 'sign', along: turn.at - 30, x: outer * (HALF_W + WALL_T + 1.2), height: 1.4 });
  }
  for (const side of [-1, 1]) {
    list.push({ type: 'flag', along: RED_LINE_S, x: side * RIM_X, height: 1.2 });
    list.push({ type: 'barrier', along: BARRIER_S, x: side * RIM_X, height: 0.4 });
  }
  list.push({ type: 'hut', along: 11, x: -(HALF_W + WALL_T + 4.5), height: 3 });
  list.push({ type: 'gantry', along: FINISH_S, x: 0, height: 5 });
  return list.filter((o) => o.along - s > 2.3 && o.along - s < MAX_Z - 2).sort((a, b) => b.along - a.along);
}

function drawObject(ctx, object, look, s, clock) {
  const z = object.along - s;
  const m = FOCAL / z;
  const sx = Math.round(W / 2 + (sample(look.L, z) + object.x) * m);
  const base = Math.round(HORIZON + CAM_H * m);
  const fog = clamp((z - FOG_START) / FOG_SPAN, 0, 0.8);
  const tint = (color) => mix(color, FOG_TARGET, fog);
  if (isVenueObject(object)) {
    drawVenueObject(ctx, object, { sx, base, m, tint, z, clock, look, s });
    return;
  }
  switch (object.type) {
    case 'pine': {
      const height = Math.round(object.height * m);
      // Cull only trees entirely outside the screen sideways (the crown is about 0.34 of the height wide each way).
      if (height >= 4 && Math.abs(sx - W / 2) <= W / 2 + Math.round(height * 0.4)) drawLugePine(ctx, sx, base, height, { seed: object.seed, tint, fog });
      break;
    }
    case 'pole': {
      const width = Math.max(1, Math.round(0.16 * m));
      ctx.fillStyle = tint(PALETTE.concrete1);
      ctx.fillRect(sx - Math.floor(width / 2), base - Math.round(object.height * m), width, Math.round(object.height * m));
      ctx.fillStyle = tint(PALETTE.paper);
      ctx.fillRect(sx - Math.round(0.45 * m), base - Math.round((object.height + 0.25) * m), Math.round(0.9 * m), Math.max(2, Math.round(0.28 * m)));
      break;
    }
    case 'sign': {
      const board = Math.round(1.3 * m);
      const high = Math.round(0.8 * m);
      const top = base - Math.round(object.height * m);
      const post = Math.max(1, Math.round(0.1 * m));
      ctx.fillStyle = tint(PALETTE.concrete2);
      ctx.fillRect(sx - Math.floor(post / 2), top, post, base - top);
      ctx.fillStyle = tint(PALETTE.orange);
      ctx.fillRect(sx - Math.floor(board / 2), top - high, board, high);
      ctx.fillStyle = tint(PALETTE.black);
      for (let i = 0; i < 4; i++) ctx.fillRect(sx - Math.floor(board / 2) + Math.round((i * board) / 4) + 1, top - high, Math.max(1, Math.round(board / 8)), high);
      break;
    }
    case 'hut': {
      const width = Math.round(5 * m);
      const high = Math.round(2.4 * m);
      const left = sx - Math.floor(width / 2);
      ctx.fillStyle = tint(PALETTE.wood3);
      ctx.fillRect(left, base - high, width, high);
      ctx.fillStyle = tint(PALETTE.wood5);
      for (let i = 0; i < width; i += Math.max(3, Math.round(0.5 * m))) ctx.fillRect(left + i, base - high, 1, high);
      ctx.fillStyle = tint(PALETTE.wood8);
      ctx.fillRect(left - Math.round(0.3 * m), base - high - Math.round(0.6 * m), width + Math.round(0.6 * m), Math.round(0.6 * m));
      ctx.fillStyle = tint(PALETTE.night);
      ctx.fillRect(sx - Math.round(0.6 * m), base - Math.round(1.7 * m), Math.round(1.2 * m), Math.round(1.7 * m));
      break;
    }
    case 'gantry': {
      const postWidth = Math.max(2, Math.round(0.5 * m));
      const high = Math.round(4.2 * m);
      const spread = Math.round((HALF_W + WALL_T + 0.6) * m);
      for (const side of [-1, 1]) {
        ctx.fillStyle = tint(PALETTE.concrete1);
        ctx.fillRect(sx + side * spread - Math.floor(postWidth / 2), base - high, postWidth, high);
        ctx.fillStyle = tint(PALETTE.concrete3);
        ctx.fillRect(sx + side * spread + (side > 0 ? Math.floor(postWidth / 2) - 1 : -Math.floor(postWidth / 2)), base - high, 1, high);
      }
      const bannerHigh = Math.round(1.0 * m);
      ctx.fillStyle = tint(PALETTE.red);
      ctx.fillRect(sx - spread, base - high - bannerHigh + Math.round(0.4 * m), spread * 2, bannerHigh);
      ctx.fillStyle = tint(PALETTE.darkRed);
      ctx.fillRect(sx - spread, base - high + Math.round(0.4 * m) - 2, spread * 2, 2);
      const scale = clamp(Math.round(m / 9), 1, 4);
      drawText(ctx, 'MAALI', sx, base - high - bannerHigh + Math.round(0.4 * m) + Math.round((bannerHigh - 7 * scale) / 2), {
        align: 'center', scale, color: PALETTE.paper,
      });
      break;
    }
    case 'flag': {
      const rimH = profileHeight(object.x, bankFor(sample(look.K, z)));
      const ground = Math.round(HORIZON + (CAM_H - rimH) * m);
      const high = Math.round(object.height * m);
      const post = Math.max(2, Math.round(0.06 * m));
      ctx.fillStyle = tint(PALETTE.paper);
      ctx.fillRect(sx - Math.floor(post / 2), ground - high, post, high);
      const flagHigh = Math.max(4, Math.round(0.45 * m));
      const flagLong = Math.max(6, Math.round(0.8 * m));
      const left = sx + Math.ceil(post / 2);
      for (let row = 0; row < flagHigh; row++) {
        const taper = 1 - (Math.abs(row + 0.5 - flagHigh / 2) / (flagHigh / 2)) * 0.55;
        ctx.fillStyle = tint(row === flagHigh - 1 && flagHigh > 3 ? PALETTE.darkRed : PALETTE.red);
        ctx.fillRect(left, ground - high + row, Math.max(1, Math.round(flagLong * taper)), 1);
      }
      break;
    }
    case 'barrier': {
      const near = z - 0.45;
      const far = z + 0.45;
      const rimH = profileHeight(object.x, bankFor(sample(look.K, z)));
      const corner = (zz, dx, up) => {
        const mm = FOCAL / zz;
        return [Math.round(W / 2 + (sample(look.L, zz) + object.x + dx) * mm), Math.round(HORIZON + (CAM_H - rimH - up) * mm)];
      };
      const [nl, nTop] = corner(near, -0.2, object.height);
      const [nr, nBottom] = corner(near, 0.2, 0);
      const [fl, fTop] = corner(far, -0.2, object.height);
      const [fr] = corner(far, 0.2, object.height);
      const [, fBottom] = corner(far, 0.2, 0);
      // Inner side (towards the track centre): a parallelogram between the near and the far inner edges.
      const nIn = object.x < 0 ? nr : nl;
      const fIn = object.x < 0 ? fr : fl;
      const step = fIn >= nIn ? 1 : -1;
      ctx.fillStyle = tint(PALETTE.concrete2);
      for (let x = nIn; x !== fIn; x += step) {
        const k = (x - nIn) / (fIn - nIn);
        const top = Math.round(nTop + (fTop - nTop) * k);
        const bottom = Math.round(nBottom + (fBottom - nBottom) * k);
        ctx.fillRect(Math.min(x, x + step), top, 1, bottom - top);
      }
      ctx.fillStyle = tint(PALETTE.concrete3);
      for (let x = nIn; x !== fIn; x += step) {
        const k = (x - nIn) / (fIn - nIn);
        const bottom = Math.round(nBottom + (fBottom - nBottom) * k);
        ctx.fillRect(Math.min(x, x + step), bottom - 1, 1, 1);
      }
      ctx.fillStyle = tint(PALETTE.concrete1);
      ctx.fillRect(nl, nTop, nr - nl, nBottom - nTop);
      ctx.fillStyle = tint(PALETTE.concrete2);
      ctx.fillRect(nl, nBottom - 1, nr - nl, 1);
      // Top face from the near top edge back to the far one, with a darker front edge.
      for (let y = nTop - 1; y >= fTop; y--) {
        const k = (nTop - y) / Math.max(1, nTop - fTop);
        const l = Math.round(nl + (fl - nl) * k);
        ctx.fillStyle = tint(PALETTE.concrete0);
        ctx.fillRect(l, y, Math.round(nr + (fr - nr) * k) - l, 1);
      }
      ctx.fillStyle = tint(PALETTE.night);
      ctx.fillRect(nl, nTop, nr - nl, 1);
      break;
    }
    default:
  }
}

// ---- track rows ---------------------------------------------------------------------------------

// A drawing context for a trackside object at distance z: pixels that fall inside the trough/rim silhouette of a
// row are skipped when the object is farther away than the rim there (the rim is in front of it). Rows below
// `maxRow` are skipped too (with the row buffer, where the later rows that would cover them are already drawn).
function maskedCtx(ctx, z, clip, maxRow = Infinity) {
  return {
    fillStyle: '#000',
    fillRect(x, y, w, rawH) {
      const h = Math.min(rawH, maxRow + 1 - y);
      if (h <= 0) return;
      ctx.fillStyle = this.fillStyle;
      // Fast path: when no row of the rect meets the rim silhouette, it is one plain rect.
      let clear = true;
      for (let row = y; row < y + h; row++) {
        const c = clip[row];
        if (c && z > c.z && x + w > Math.round(c.left) && x < Math.round(c.right)) {
          clear = false;
          break;
        }
      }
      if (clear) {
        ctx.fillRect(x, y, w, h);
        return;
      }
      // Visible part left of the silhouette and right of it, per row; rows with the same parts are merged into
      // one taller rect (a narrow post crossing the rim is a few rects, not one per row).
      let runY = y;
      let runA = null;
      let runB = null;
      const flush = (end) => {
        if (runA) ctx.fillRect(runA[0], runY, runA[1], end - runY);
        if (runB) ctx.fillRect(runB[0], runY, runB[1], end - runY);
      };
      for (let row = y; row < y + h; row++) {
        const c = clip[row];
        let a = null;
        let b = null;
        if (!c || z <= c.z) {
          a = [x, w];
        } else {
          const left = Math.round(c.left);
          const right = Math.round(c.right);
          if (x < left) a = [x, Math.min(x + w, left) - x];
          if (x + w > right) b = [Math.max(x, right), x + w - Math.max(x, right)];
        }
        const same = (p, q) => (p === null ? q === null : q !== null && p[0] === q[0] && p[1] === q[1]);
        if (row > y && same(a, runA) && same(b, runB)) continue;
        flush(row);
        runY = row;
        runA = a;
        runB = b;
      }
      flush(y + h);
    },
  };
}

// The opaque base of one screen row, covering its full width: snow, ice, rims, padding, lips, grooves and the
// racing line. Returns the line marks of the row and its rim silhouette, or null beyond the track.
function drawRowBase(ctx, y, s, look, view, lines) {
  const dy = y - HORIZON;
  const z = (CAM_H * FOCAL) / dy;
  const fog = clamp((z - FOG_START) / FOG_SPAN, 0, 1);
  const tint = (color) => mix(color, FOG_TARGET, fog);
  const along = s + z;
  fillRow(ctx, 0, W, y, tint(Math.floor(along / 8) % 2 === 0 ? PALETTE.snowLight : PALETTE.snowMid));

  if (z < MAX_Z - 1) {
    const bank = bankFor(sample(look.K, z));
    // Project the cross-section: every sample sits at its own distance because higher points are nearer.
    const points = SAMPLE_XS.map((x) => {
      const h = profileHeight(x, bank);
      const zi = ((CAM_H - h) * FOCAL) / dy;
      return { x, z: zi, sx: W / 2 + (sample(look.L, zi) + x) * (FOCAL / zi) };
    });
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (b.sx <= a.sx) continue;
      const midX = (a.x + b.x) / 2;
      const midZ = (a.z + b.z) / 2;
      const midAlong = s + midZ;
      const spanFog = clamp((midZ - FOG_START) / FOG_SPAN, 0, 1);
      const rim = Math.abs(midX) > HALF_W;
      const color = rim
        ? RIM_COLOR
        : iceColor(profileSlope(midX, bank), Math.abs(midX) / HALF_W, Math.floor(midAlong / 5) % 2 === 0);
      fillRow(ctx, a.sx, b.sx, y, mix(color, rim ? FOG_TARGET : ICE_FOG, spanFog));
    }
    // Rim outline and the two runner grooves in the bottom of the trough.
    const left = points[0];
    const right = points.at(-1);
    drawPadding(ctx, look, bank, dy, s, y, bank > 0 ? left.sx : right.sx);
    drawLip(ctx, y, left.sx, points[1].sx, -1, tint);
    drawLip(ctx, y, right.sx, points.at(-2).sx, 1, tint);
    // Start line, hop band and finish checker on this row: strictly inside the lip shadows, painted last.
    const marks = lines === null ? null : lines.row(y, lipInner(left.sx, points[1].sx, -1) + 1, lipInner(right.sx, points.at(-2).sx, 1) - 2, bank);
    for (const groove of [-0.9, 0.9]) {
      const zg = ((CAM_H - profileHeight(groove, bank)) * FOCAL) / dy;
      const sx = W / 2 + (sample(look.L, zg) + groove) * (FOCAL / zg);
      const wide = Math.max(2, (0.3 * FOCAL) / zg);
      const core = Math.max(1, (0.1 * FOCAL) / zg);
      const [faint, strong] = sheenTones(iceColor(profileSlope(groove, bank), Math.abs(groove) / HALF_W, Math.floor((s + z) / 5) % 2 === 0));
      if (!runsCover(marks, Math.round(sx))) {
        fillRow(ctx, sx - wide, sx + wide, y, tint(faint));
        fillRow(ctx, sx - core, sx + core, y, tint(strong));
      }
      fillRow(ctx, sx, sx + 1, y, tint(PALETTE.trackGroove));
    }
    if (view.showLine) {
      const along = s + z;
      if (Math.floor(along / LINE_DASH) % 2 === 0) {
        const x = racingLineAt(along) * SLED_X_RANGE;
        const zl = ((CAM_H - profileHeight(x, bank)) * FOCAL) / dy;
        const sx = W / 2 + (sample(look.L, zl) + x) * (FOCAL / zl);
        const width = Math.max(1, Math.round((LINE_WIDTH * FOCAL) / zl));
        fillRow(ctx, sx - width / 2, sx + width / 2, y, tint(PALETTE.orange));
      }
    }
    return { marks, clip: { left: left.sx, right: right.sx, z: Math.min(left.z, right.z) } };
  }
  return null;
}

function drawRows(ctx, s, look, view) {
  const objects = buildScenery(s);
  const lines = lineOverlay(s, look, {
    showRedLine: view.showRedLine,
    tint: (color, z) => mix(color, FOG_TARGET, clamp((z - FOG_START) / FOG_SPAN, 0, 1)),
  });
  const clip = [];
  let next = 0;
  const flushObjects = (y, maxRow) => {
    while (next < objects.length) {
      const z = objects[next].along - s;
      if (HORIZON + CAM_H * (FOCAL / z) > y) break;
      drawObject(maskedCtx(ctx, z, clip, maxRow), objects[next], look, s, view.clock);
      next += 1;
    }
  };

  // With a row buffer every row base is drawn first and copied at once. That keeps the look: a row base covers
  // its whole row, so an object pixel below the row it is drawn after never showed, and the objects are clipped
  // there; the line marks and objects of each row are then drawn in the same order as before.
  const buffer = createRowBuffer(ctx, W, HORIZON + 1, H - HORIZON - 1);
  if (buffer) {
    const marks = [];
    for (let y = HORIZON + 1; y < H; y++) {
      const row = drawRowBase(buffer, y, s, look, view, lines);
      if (row) {
        marks[y] = row.marks;
        clip[y] = row.clip;
      }
    }
    buffer.put();
    for (let y = HORIZON + 1; y < H; y++) {
      if (marks[y] !== undefined) paintRuns(ctx, y, marks[y]);
      flushObjects(y, y);
    }
    return;
  }
  for (let y = HORIZON + 1; y < H; y++) {
    const row = drawRowBase(ctx, y, s, look, view, lines);
    if (row) {
      paintRuns(ctx, y, row.marks);
      clip[y] = row.clip;
    }
    flushObjects(y);
  }
}

// ---- HUD ----------------------------------------------------------------------------------------

function drawHud(ctx, view) {
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, W, HUD_HEIGHT);
  drawText(ctx, `AIKA ${formatTime(view.time ?? 0)}`, 8, 6, { scale: TEXT_SCALE, color: PALETTE.white });
  drawText(ctx, `${Math.round(view.speedKmh)} KM/H`, 8, 24, { scale: TEXT_SCALE, color: PALETTE.white });
  const barX = 120;
  const barWidth = 150;
  const maxKmh = 200;
  ctx.fillStyle = PALETTE.darkGrey;
  ctx.fillRect(barX, 26, barWidth, 10);
  ctx.fillStyle = view.warning && Math.floor(view.clock * 6) % 2 === 0 ? PALETTE.orange : PALETTE.paper;
  ctx.fillRect(barX, 26, Math.round((barWidth * Math.min(view.speedKmh, maxKmh)) / maxKmh), 10);
  if (view.limitKmh) {
    ctx.fillStyle = PALETTE.red;
    ctx.fillRect(barX + Math.round((barWidth * view.limitKmh) / maxKmh) - 1, 22, 3, 18);
  }
  drawText(ctx, view.label ?? 'HARJOITUS 1', W / 2 + 40, 6, { align: 'center', scale: TEXT_SCALE, color: PALETTE.skyLight });
  drawText(ctx, view.phase === 'push' ? 'TYÖNTÖ' : `KÄÄNNÖS ${view.turn ?? 1}/10`, W - 8, 6, { align: 'right', scale: TEXT_SCALE, color: PALETTE.white });
}

export function renderLuge(ctx, view) {
  const s = view.s;
  const clock = view.clock ?? view.time ?? 0;
  const look = lookahead(s);
  const full = { ...view, clock, bank: bankFor(sample(look.K, SLED_Z + 0.7)) };
  drawBackdrop(ctx, s, clock);
  drawRows(ctx, s, look, full);
  drawSledAndRider(ctx, look, full);
  if (view.phase === 'push') drawRunner(ctx, look, full, view.stride ?? 0);
  if (view.sparks) {
    const rng = createRng(77);
    const [x, y] = project(look, view.lateral * 1.9, profileHeight(view.lateral * 1.9, full.bank) + 0.1, SLED_Z - 0.1);
    ctx.fillStyle = PALETTE.paper;
    for (let i = 0; i < 16; i++) ctx.fillRect(Math.round(x + (rng() - 0.5) * 70), Math.round(y - rng() * 28), 2, 2);
  }
  drawSnowfall(ctx, clock);
  drawHud(ctx, full);
  if (view.banner) drawBlinking(ctx, view.banner, W / 2, 96, clock, { scale: TEXT_SCALE, color: PALETTE.paper, shadow: PALETTE.slate });
}
