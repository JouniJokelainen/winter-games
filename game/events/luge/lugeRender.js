// Luge scene renderer (art trial). Segment-style pseudo-3D drawn row by row from the horizon to the
// bottom of the 640×512 canvas: ice track, banked concrete walls, snow, trees, spectators and signs.
import { formatTime } from '../../core/format.js';
import { drawBlinking } from '../../engine/draw.js';
import { drawText } from '../../engine/font.js';
import { PALETTE } from '../../engine/palette.js';
import { createRng } from '../../engine/rng.js';
import { drawForestLayer, drawPine, drawSnowfall } from '../../engine/scenery.js';
import { drawRunner, drawSledAndRider } from './lugeSled.js';
import {
  bankFor, CAM_H, FOCAL, H, HALF_W, HORIZON, lookahead, MAX_Z, profileHeight, profileSlope, project, sample, SLED_Z, W, WALL_T,
} from './lugeProjection.js';
import { FINISH_S, headingAt, RED_LINE_S, TURNS } from './lugeTrack.js';

const HUD_HEIGHT = 44;
const TEXT_SCALE = 2;
const SKY_BANDS = [PALETTE.mist0, PALETTE.mist1, PALETTE.mist2, PALETTE.mist3, PALETTE.mist4];
const FOG_TARGET = PALETTE.mist3;
const FOG_START = 40;
const FOG_SPAN = 150;
const SPECTATOR_COLORS = [PALETTE.suitPink, PALETTE.guide, PALETTE.wood2, PALETTE.pineLight, PALETTE.concrete1, PALETTE.red];

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
const RIM_COLOR = mix(PALETTE.white, PALETTE.skyLight, 0.3);
const X_OUT = HALF_W + WALL_T;

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
  if (band) color = mix(color, PALETTE.white, 0.07);
  return color;
}


// ---- backdrop -----------------------------------------------------------------------------------

function drawBackdrop(ctx, s) {
  const bandHeight = HORIZON / SKY_BANDS.length;
  SKY_BANDS.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, Math.floor(index * bandHeight), W, Math.ceil(bandHeight));
  });
  const camera = { x: headingAt(s) * 600, y: 1200 };
  // Soft distant ridge.
  for (let sx = 0; sx < W; sx++) {
    const m = sx + camera.x * 0.08;
    const top = Math.round(HORIZON - 24 - 10 * Math.sin(m * 0.012) - 6 * Math.sin(m * 0.031 + 2));
    ctx.fillStyle = PALETTE.snowDark;
    ctx.fillRect(sx, top, 1, HORIZON - top);
  }
  drawForestLayer(ctx, camera, { parallax: 0.2, spacing: 26, minHeight: 12, maxHeight: 22, baseY: HORIZON - 14, seed: 31 });
}

// ---- trackside objects --------------------------------------------------------------------------

function buildScenery(s) {
  const list = [];
  const first = Math.floor((s + 2) / 12);
  const last = Math.floor((s + MAX_Z) / 12);
  for (let i = first; i <= last; i++) {
    const rng = createRng(500 + i);
    const along = i * 12;
    const edge = HALF_W + WALL_T;
    list.push({ type: 'pine', along: along + rng() * 8, x: -(edge + 2.5 + rng() * 5), height: 7 + rng() * 4 });
    list.push({ type: i % 3 === 0 ? 'crowd' : 'pine', along: along + rng() * 8, x: edge + 1.6 + rng() * 5, height: 7 + rng() * 4, seed: i });
    if (i % 3 === 1) list.push({ type: 'pole', along, x: edge + 0.9, height: 6 });
  }
  for (const turn of TURNS) {
    const outer = turn.k > 0 ? -1 : 1;
    list.push({ type: 'sign', along: turn.at - 30, x: outer * (HALF_W + WALL_T + 1.2), height: 1.4 });
  }
  list.push({ type: 'hut', along: 11, x: -(HALF_W + WALL_T + 4.5), height: 3 });
  list.push({ type: 'gantry', along: FINISH_S, x: 0, height: 5 });
  return list.filter((o) => o.along - s > 2.3 && o.along - s < MAX_Z - 2).sort((a, b) => b.along - a.along);
}

function drawObject(ctx, object, look, s) {
  const z = object.along - s;
  const m = FOCAL / z;
  const sx = Math.round(W / 2 + (sample(look.L, z) + object.x) * m);
  const base = Math.round(HORIZON + CAM_H * m);
  const fog = clamp((z - FOG_START) / FOG_SPAN, 0, 0.8);
  const tint = (color) => mix(color, FOG_TARGET, fog);
  switch (object.type) {
    case 'pine': {
      const height = Math.round(object.height * m);
      if (height >= 4) drawPine(ctx, sx, base, height);
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
    case 'crowd': {
      const rng = createRng(900 + object.seed);
      for (let i = 0; i < 3; i++) {
        const offset = Math.round((i - 1) * 0.75 * m);
        const body = Math.round(0.5 * m);
        const high = Math.round(1.0 * m);
        const x = sx + offset;
        ctx.fillStyle = tint(PALETTE.concrete3);
        ctx.fillRect(x - Math.floor(body / 2), base - Math.round(0.5 * m), body, Math.round(0.5 * m));
        ctx.fillStyle = tint(SPECTATOR_COLORS[Math.floor(rng() * SPECTATOR_COLORS.length)]);
        ctx.fillRect(x - Math.floor(body / 2), base - Math.round(0.5 * m) - high, body, high);
        ctx.fillStyle = tint(PALETTE.skin);
        ctx.fillRect(x - Math.floor(body / 4), base - Math.round(0.5 * m) - high - Math.round(0.3 * m), Math.round(body / 2), Math.round(0.3 * m));
        ctx.fillStyle = tint(SPECTATOR_COLORS[Math.floor(rng() * SPECTATOR_COLORS.length)]);
        ctx.fillRect(x - Math.floor(body / 4), base - Math.round(0.5 * m) - high - Math.round(0.42 * m), Math.round(body / 2), Math.max(1, Math.round(0.14 * m)));
      }
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
      ctx.fillStyle = this.fillStyle;
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
      drawObject(maskedCtx(ctx, z, clip), objects[next], look, s);
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
        if (view.showRedLine && Math.abs(midAlong - RED_LINE_S) < 0.35) color = PALETTE.red;
        if (!rim && Math.abs(midAlong - FINISH_S) < 0.55) color = i % 2 === 0 ? PALETTE.black : PALETTE.paper;
        fillRow(ctx, a.sx, b.sx, y, mix(color, FOG_TARGET, spanFog));
      }
      // Rim outline and the two runner grooves in the bottom of the trough.
      const left = points[0];
      const right = points.at(-1);
      fillRow(ctx, left.sx, left.sx + 1, y, tint(PALETTE.concrete2));
      fillRow(ctx, right.sx - 1, right.sx, y, tint(PALETTE.concrete2));
      for (const groove of [-0.9, 0.9]) {
        const zg = ((CAM_H - profileHeight(groove, bank)) * FOCAL) / dy;
        const sx = W / 2 + (sample(look.L, zg) + groove) * (FOCAL / zg);
        fillRow(ctx, sx, sx + 1, y, tint(PALETTE.trackGroove));
      }
      clip[y] = { left: left.sx, right: right.sx, z: Math.min(left.z, right.z) };
    }
    flushObjects(y);
  }
}

// ---- HUD ----------------------------------------------------------------------------------------

function drawHud(ctx, view) {
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, W, HUD_HEIGHT);
  drawText(ctx, `AIKA ${formatTime(view.time)}`, 8, 6, { scale: TEXT_SCALE, color: PALETTE.white });
  drawText(ctx, `${Math.round(view.speedKmh)} KM/H`, 8, 24, { scale: TEXT_SCALE, color: PALETTE.white });
  const barX = 120;
  const barWidth = 150;
  const maxKmh = 200;
  ctx.fillStyle = PALETTE.darkGrey;
  ctx.fillRect(barX, 26, barWidth, 10);
  ctx.fillStyle = view.warning && Math.floor(view.time * 6) % 2 === 0 ? PALETTE.orange : PALETTE.paper;
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
  const look = lookahead(s);
  const full = { ...view, bank: bankFor(sample(look.K, SLED_Z + 0.7)) };
  drawBackdrop(ctx, s);
  drawRows(ctx, s, look, full);
  drawSledAndRider(ctx, look, full);
  if (view.phase === 'push') drawRunner(ctx, look, full, view.stride ?? 0);
  if (view.sparks) {
    const rng = createRng(77);
    const [x, y] = project(look, view.lateral * 1.9, profileHeight(view.lateral * 1.9, full.bank) + 0.1, SLED_Z - 0.1);
    ctx.fillStyle = PALETTE.paper;
    for (let i = 0; i < 16; i++) ctx.fillRect(Math.round(x + (rng() - 0.5) * 70), Math.round(y - rng() * 28), 2, 2);
  }
  drawSnowfall(ctx, view.time);
  drawHud(ctx, view);
  if (view.banner) drawBlinking(ctx, view.banner, W / 2, 96, view.time, { scale: TEXT_SCALE, color: PALETTE.paper, shadow: PALETTE.slate });
}
