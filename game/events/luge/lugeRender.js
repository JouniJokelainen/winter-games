// Luge scene renderer (art trial). Segment-style pseudo-3D drawn row by row from the horizon to the
// bottom of the 640×512 canvas: ice track, banked concrete walls, snow, trees, spectators and signs.
import { formatTime } from '../../core/format.js';
import { drawBlinking } from '../../engine/draw.js';
import { drawText } from '../../engine/font.js';
import { PALETTE } from '../../engine/palette.js';
import { createRng } from '../../engine/rng.js';
import { drawSnowfall } from '../../engine/scenery.js';
import { drawForestBackdrop, drawLugePine, forestObjects } from './lugeForest.js';
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
const START_LINE_S = -0.9; // white start line: just behind the runner, near the bottom of the ready frame
const BARRIER_S = -0.3; // start barriers on the rims, beside the sled
const HOP_BAND_HALF = 0.45; // metres; grows with distance so the band stays a few pixels thick far away

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
const RIM_COLOR = mix(PALETTE.white, PALETTE.skyLight, 0.12); // icy top lip
const LIP_EDGE = PALETTE.white; // thin highlight on the inner edge of the lip
const WALL_SHADE = '#5a647c'; // cool shadow deep in the walls
const ICE_SHEEN = mix(PALETTE.trackIce, PALETTE.white, 0.3); // streak along each runner groove
const ICE_FOG = mix(FOG_TARGET, PALETTE.white, 0.3); // the ice fades to a lighter mist than the snow: a faint sheen towards the horizon
const X_OUT = HALF_W + WALL_T;

// Padding on the outer side of a turn: a low dark-blue strip along the rim, outside the icy lip.
const PAD_FACE = '#2f3d5c';
const PAD_TOP_A = '#4a5d85';
const PAD_TOP_B = '#3b4b70';
export const PADDING_COLORS = [PAD_FACE, PAD_TOP_A, PAD_TOP_B];
const PAD_H = 0.25; // metres above the rim (the rim is at most 2.0 m, the camera is at 2.4 m)
const PAD_W = 0.9; // metres outwards from the rim

// Cross-section sample positions: the rim caps and 24 steps across the trough.
const SAMPLE_XS = [-X_OUT, ...Array.from({ length: 25 }, (_, i) => -HALF_W + (i * 2 * HALF_W) / 24), X_OUT];

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

function computeIce(slope, depth, band) {
  let color = mix(ICE_DARK, ICE_LIT, clamp(0.5 - 0.42 * slope, 0, 1));
  color = mix(color, PALETTE.skyLight, 0.12);
  color = mix(color, PALETTE.concrete3, 0.22 * depth);
  color = mix(color, WALL_SHADE, 0.55 * depth ** 2.5);
  if (band) color = mix(color, PALETTE.white, 0.07);
  return color;
}


// One screen row of the padding: the face towards the track, then the top. The outer rim is the higher one.
function drawPadding(ctx, look, bank, dy, s, y, rimSx) {
  const height = PAD_H * clamp((Math.abs(bank) - 0.1) / 0.4, 0, 1);
  if (height < 0.05) return;
  const side = bank > 0 ? -1 : 1;
  const topH = Math.min(profileHeight(side * HALF_W, bank) + height, CAM_H - 0.1);
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
  } else {
    fillRow(ctx, topSx, faceSx, y, mix(top, FOG_TARGET, fog));
    fillRow(ctx, faceSx, rimSx, y, mix(PAD_FACE, FOG_TARGET, fog));
  }
}

// ---- backdrop -----------------------------------------------------------------------------------

function drawBackdrop(ctx, s, clock) {
  const heading = headingAt(s);
  drawLugeSky(ctx, { heading, clock, horizon: HORIZON }, () => {
    drawForestBackdrop(ctx, { heading, horizon: HORIZON, tint: (color, amount) => mix(color, FOG_TARGET, amount) });
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
// row are skipped when the object is farther away than the rim there (the rim is in front of it).
function maskedCtx(ctx, z, clip) {
  return {
    fillStyle: '#000',
    fillRect(x, y, w, h) {
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
      for (let row = y; row < y + h; row++) {
        const c = clip[row];
        if (!c || z <= c.z) {
          ctx.fillRect(x, row, w, 1);
        } else {
          const left = Math.round(c.left);
          const right = Math.round(c.right);
          if (x < left) ctx.fillRect(x, row, Math.min(x + w, left) - x, 1);
          if (x + w > right) ctx.fillRect(Math.max(x, right), row, x + w - Math.max(x, right), 1);
        }
      }
    },
  };
}

function drawRows(ctx, s, look, view) {
  const objects = buildScenery(s);
  const clip = [];
  let next = 0;
  const flushObjects = (y) => {
    while (next < objects.length) {
      const z = objects[next].along - s;
      if (HORIZON + CAM_H * (FOCAL / z) > y) break;
      drawObject(maskedCtx(ctx, z, clip), objects[next], look, s, view.clock);
      next += 1;
    }
  };

  for (let y = HORIZON + 1; y < H; y++) {
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
        let color = rim
          ? RIM_COLOR
          : iceColor(profileSlope(midX, bank), Math.abs(midX) / HALF_W, Math.floor(midAlong / 5) % 2 === 0);
        if (!rim) {
          if (view.showRedLine) {
            const half = Math.max(HOP_BAND_HALF, 0.08 * midZ);
            const edgeW = Math.max(0.08, 0.016 * midZ);
            const d = Math.abs(midAlong - RED_LINE_S);
            if (d < half) color = d > half - edgeW ? PALETTE.paper : PALETTE.red;
            else if (d < half + edgeW) color = PALETTE.paper;
          }
        }
        if (!rim && Math.abs(midAlong - FINISH_S) < 0.55) color = i % 2 === 0 ? PALETTE.black : PALETTE.paper;
        fillRow(ctx, a.sx, b.sx, y, mix(color, rim ? FOG_TARGET : ICE_FOG, spanFog));
      }
      // Rim outline and the two runner grooves in the bottom of the trough.
      const left = points[0];
      const right = points.at(-1);
      if (Math.abs(bank) > 0.1) drawPadding(ctx, look, bank, dy, s, y, bank > 0 ? left.sx : right.sx);
      fillRow(ctx, points[1].sx - 1, points[1].sx, y, tint(LIP_EDGE));
      fillRow(ctx, points.at(-2).sx, points.at(-2).sx + 1, y, tint(LIP_EDGE));
      fillRow(ctx, left.sx, left.sx + 1, y, tint(PALETTE.concrete2));
      fillRow(ctx, right.sx - 1, right.sx, y, tint(PALETTE.concrete2));
      for (const groove of [-0.9, 0.9]) {
        const zg = ((CAM_H - profileHeight(groove, bank)) * FOCAL) / dy;
        const sx = W / 2 + (sample(look.L, zg) + groove) * (FOCAL / zg);
        const half = Math.max(1, (0.06 * FOCAL) / zg);
        fillRow(ctx, sx - half, sx + half, y, tint(ICE_SHEEN));
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
      clip[y] = { left: left.sx, right: right.sx, z: Math.min(left.z, right.z) };
    }
    flushObjects(y);
  }
}

// Thin start line across the ice: sampled along the trough profile and drawn as a 2 px curve, so it stays neat
// where a per-row colour test would make a chunky stair-step.
function drawStartLine(ctx, s, look, bank) {
  const z = START_LINE_S - s;
  if (z <= 2.3 || z >= MAX_Z - 2) return;
  const steps = 64;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const x = -HALF_W + (i * 2 * HALF_W) / steps;
    const [sx, sy] = project(look, x, profileHeight(x, bank), z);
    points.push([Math.round(sx), Math.round(sy)]);
  }
  ctx.fillStyle = PALETTE.paper;
  for (let i = 0; i < steps; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const dx = x1 - x0;
    if (dx <= 0) continue;
    for (let x = x0; x < x1; x++) {
      const y = Math.round(y0 + ((y1 - y0) * (x - x0)) / dx);
      if (y >= 0 && y < H - 1) ctx.fillRect(x, y, 1, 2);
    }
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
  drawStartLine(ctx, s, look, full.bank);
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
