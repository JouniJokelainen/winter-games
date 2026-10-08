// The ice of the luge trough: a continuous shading across the trough (lit from the right: the left wall bright,
// the right wall dark, darker deep in the walls), soft transversal bands every 5 m, wide dim wear lanes along the
// runner paths and a faint ice texture (mottling, grain and short scratches) that is a fixed function of the
// position on the track, so it sticks to the ice and never shimmers by itself.
//
// With a row buffer (pixel access) every pixel is shaded: the shade is interpolated between the projected
// cross-section samples and the texture is looked up by trough position and distance along the track.
// Without one (tests' recording contexts) every segment between two samples is one rect in its mid shade.
import { PALETTE } from '../../engine/palette.js';
import { createRng } from '../../engine/rng.js';
import { BANK_H, HALF_W, RIM_H } from './lugeProjection.js';
import { PIXELS_LITTLE_ENDIAN } from './lugeRowBuffer.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

const WHITE = rgbOf(PALETTE.white);
const ICE_LIT = lerp3(rgbOf(PALETTE.trackIce), WHITE, 0.45);
const ICE_DARK = lerp3(rgbOf(PALETTE.trackIce), rgbOf(PALETTE.concrete3), 0.6);
const SKY = rgbOf(PALETTE.skyLight);
const CONCRETE = rgbOf(PALETTE.concrete3);
const WALL_SHADE = rgbOf('#36405a'); // cool shadow deep in the walls

const BAND_PERIOD = 10; // metres: a lighter band on the first 5 m of every 10
const BAND_MEAN = 0.022; // share of white mixed in on average ...
const BAND_AMP = 0.018; // ... plus or minus this, along a cosine

// Texture tile: TEX_U columns across the trough (rim to rim) and TEX_A rows along TEX_PERIOD metres of track;
// values are channel offsets (0..255 scale). A 4×4 averaged copy (COARSE) is used farther away.
const TEX_U = 256;
const TEX_A = 512;
const TEX_PERIOD = 20; // metres; a multiple of the band period
const DU = (2 * HALF_W) / TEX_U;
const DA = TEX_PERIOD / TEX_A;
const CU = TEX_U / 4;
const CA = TEX_A / 4;
const ALONG_BIAS = TEX_A * 4096; // keeps texture rows positive before the bit mask (the track starts at s < 0)

// Distance fades (metres, at the bottom of the trough of the screen row): the fine texture until its texels
// shrink to about a pixel, then the coarse one, then only the smooth shading.
const FINE_FULL = 4.5;
const FINE_END = 6.5;
const COARSE_FULL = 7;
const COARSE_END = 13;
// Wear lanes along the runner paths: a little darker (polished), wide and soft, fading to a hint far away.
// Texture amplitudes (channel steps): smooth mottling, per-texel grain and the lighter scratches.
const MOTTLE = 5;
const GRAIN = 1.3;
const SCRATCH_MIN = 3;
const SCRATCH_MAX = 7;
const LANE_X = 0.9;
const LANE_SIGMA = 0.17;
const LANE_DARK = 0.05;
const LANE_FAR = 0.35;
const LANE_FADE_FROM = 12;
const LANE_FADE_TO = 60;

function buildTextures() {
  const rng = createRng(4711);
  const fine = new Float32Array(TEX_U * TEX_A);
  // Mottling: smooth value noise on a coarse grid (wrapping along the track).
  const MU = 16;
  const MA = 32;
  const grid = Array.from({ length: (MU + 1) * MA }, () => rng() * 2 - 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let a = 0; a < TEX_A; a++) {
    const fa = (a / TEX_A) * MA;
    const ia = Math.floor(fa);
    const ta = smooth(fa - ia);
    const ib = (ia + 1) % MA;
    for (let u = 0; u < TEX_U; u++) {
      const fu = (u / TEX_U) * MU;
      const iu = Math.floor(fu);
      const tu = smooth(fu - iu);
      const top = grid[ia * (MU + 1) + iu] + (grid[ia * (MU + 1) + iu + 1] - grid[ia * (MU + 1) + iu]) * tu;
      const bottom = grid[ib * (MU + 1) + iu] + (grid[ib * (MU + 1) + iu + 1] - grid[ib * (MU + 1) + iu]) * tu;
      fine[a * TEX_U + u] = MOTTLE * (top + (bottom - top) * ta) + (rng() - 0.5) * 2 * GRAIN;
    }
  }
  // Scratches: short, faint, lighter streaks along the track, denser along the runner paths.
  for (let i = 0; i < 360; i++) {
    const nearLane = rng() < 0.55;
    const x = nearLane
      ? (rng() < 0.5 ? -LANE_X : LANE_X) + (rng() + rng() + rng() - 1.5) * 0.35
      : (rng() * 2 - 1) * HALF_W * 0.92;
    const start = rng() * TEX_A;
    const rows = (0.4 + rng() * 2.2) / DA;
    const drift = ((rng() - 0.5) * 0.06 * DA) / DU; // columns per row
    const strength = SCRATCH_MIN + rng() * (SCRATCH_MAX - SCRATCH_MIN);
    for (let r = 0; r < rows; r++) {
      const col = (x + HALF_W) / DU + drift * r;
      const c = Math.floor(col);
      if (c < 1 || c >= TEX_U - 1) break;
      const w = col - c;
      const value = strength * Math.sin((Math.PI * (r + 0.5)) / rows);
      const row = ((Math.floor(start + r) % TEX_A) + TEX_A) % TEX_A;
      // A soft profile about two texels wide, split between the texels it falls on.
      fine[row * TEX_U + c - 1] += value * 0.3 * (1 - w);
      fine[row * TEX_U + c] += value * (1 - 0.7 * w);
      fine[row * TEX_U + c + 1] += value * (0.3 + 0.7 * w);
      if (c + 2 < TEX_U) fine[row * TEX_U + c + 2] += value * 0.3 * w;
    }
  }
  for (let i = 0; i < fine.length; i++) fine[i] = clamp(fine[i], -10, 12);
  const coarse = new Float32Array(CU * CA);
  for (let a = 0; a < TEX_A; a++) for (let u = 0; u < TEX_U; u++) coarse[(a >> 2) * CU + (u >> 2)] += fine[a * TEX_U + u] / 16;
  // Lane darkening per texture column (0..1).
  const lanes = new Float32Array(TEX_U);
  for (let u = 0; u < TEX_U; u++) {
    const x = -HALF_W + (u + 0.5) * DU;
    lanes[u] = Math.exp(-(((x - LANE_X) / LANE_SIGMA) ** 2)) + Math.exp(-(((x + LANE_X) / LANE_SIGMA) ** 2));
  }
  return { fine, coarse, lanes };
}

const { fine: FINE, coarse: COARSE, lanes: LANES } = buildTextures();

// Slope dh/dx of the trough surface (as profileSlope, but continuous up to the rims).
function slopeAt(x, bank) {
  const u = clamp(x / HALF_W, -1, 1);
  return (RIM_H * 2.4 * Math.abs(u) ** 1.4 * Math.sign(u)) / HALF_W - (bank * BANK_H) / HALF_W;
}

// Smooth shade of the ice at trough position x (metres) and distance `along` the track, with fog 0..1 towards
// `fogRgb`. Written into out[0..2].
export function iceShade(x, bank, along, fog, fogRgb, out) {
  const depth = Math.min(1, Math.abs(x) / HALF_W);
  const lit = clamp(0.5 - 0.42 * slopeAt(x, bank), 0, 1);
  const band = BAND_MEAN + BAND_AMP * Math.cos((2 * Math.PI * (along - BAND_PERIOD / 4)) / BAND_PERIOD);
  const concrete = 0.22 * depth;
  const shade = 0.85 * depth * depth;
  for (let k = 0; k < 3; k++) {
    let c = ICE_DARK[k] + (ICE_LIT[k] - ICE_DARK[k]) * lit;
    c += (SKY[k] - c) * 0.12;
    c += (CONCRETE[k] - c) * concrete;
    c += (WALL_SHADE[k] - c) * shade;
    c += (WHITE[k] - c) * band;
    out[k] = c + (fogRgb[k] - c) * fog;
  }
  return out;
}

const laneAt = (x) => LANES[clamp(Math.floor((x + HALF_W) / DU), 0, TEX_U - 1)];
const ramp = (z, from, to) => clamp((z - from) / (to - from), 0, 1);

// A painter for the ice of one screen row. `fogOf(z)` gives the fog amount 0..1 at distance z.
export function createIcePainter({ fogOf, fogColor }) {
  const fogRgb = rgbOf(fogColor);
  const R = new Float64Array(64);
  const G = new Float64Array(64);
  const B = new Float64Array(64);
  const U = new Float64Array(64);
  const A = new Float64Array(64);
  const out = [0, 0, 0];

  // points: the projected cross-section {x, z, sx}; the ice runs from points[first] to points[last].
  return function paintIce(target, y, points, first, last, s, bank, rowZ) {
    for (let i = first; i <= last; i++) {
      const p = points[i];
      iceShade(p.x, bank, s + p.z, fogOf(p.z), fogRgb, out);
      R[i] = out[0];
      G[i] = out[1];
      B[i] = out[2];
      U[i] = (p.x + HALF_W) / DU;
      A[i] = (s + p.z) / DA + ALONG_BIAS;
    }
    const laneW = LANE_DARK * (1 - (1 - LANE_FAR) * ramp(rowZ, LANE_FADE_FROM, LANE_FADE_TO));
    if (!target.pixels) {
      for (let i = first; i < last; i++) {
        const a = points[i];
        const b = points[i + 1];
        if (b.sx <= a.sx) continue;
        const left = Math.round(a.sx);
        const width = Math.round(b.sx) - left;
        if (width <= 0) continue;
        const k = 1 - laneW * laneAt((a.x + b.x) / 2);
        const ch = (v) => HEX[clamp(Math.round(v * k), 0, 255)];
        target.fillStyle = `#${ch((R[i] + R[i + 1]) / 2)}${ch((G[i] + G[i + 1]) / 2)}${ch((B[i] + B[i + 1]) / 2)}`;
        target.fillRect(left, y, width, 1);
      }
      return;
    }
    const fineW = 1 - ramp(rowZ, FINE_FULL, FINE_END);
    const coarseW = Math.min(1 - fineW, 1 - ramp(rowZ, COARSE_FULL, COARSE_END));
    const { pixels, width } = target;
    const rowStart = (y - target.top) * width;
    for (let i = first; i < last; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (b.sx <= a.sx) continue;
      const x0 = Math.max(0, Math.round(a.sx));
      const x1 = Math.min(width, Math.round(b.sx));
      if (x1 <= x0) continue;
      const inv = 1 / (b.sx - a.sx);
      const t0 = (x0 + 0.5 - a.sx) * inv;
      const dr = (R[i + 1] - R[i]) * inv;
      const dg = (G[i + 1] - G[i]) * inv;
      const db = (B[i + 1] - B[i]) * inv;
      const du = (U[i + 1] - U[i]) * inv;
      const da = (A[i + 1] - A[i]) * inv;
      let r = R[i] + dr * (x0 + 0.5 - a.sx);
      let g = G[i] + dg * (x0 + 0.5 - a.sx);
      let bl = B[i] + db * (x0 + 0.5 - a.sx);
      let u = U[i] + (U[i + 1] - U[i]) * t0;
      let al = A[i] + (A[i + 1] - A[i]) * t0;
      for (let x = x0; x < x1; x++) {
        const iu = u < 0 ? 0 : u >= TEX_U ? TEX_U - 1 : u | 0;
        const ia = (al | 0) & (TEX_A - 1);
        let v = 0;
        if (fineW > 0) {
          // Interpolated across the track (texels are a few pixels wide near the sled), nearest along it.
          const fu = u < 0.5 ? 0 : u > TEX_U - 1.5 ? TEX_U - 1.5 : u - 0.5;
          const i0 = fu | 0;
          const j = ia * TEX_U + i0;
          v += fineW * (FINE[j] + (FINE[j + 1] - FINE[j]) * (fu - i0));
        }
        if (coarseW > 0) v += coarseW * COARSE[(ia >> 2) * CU + (iu >> 2)];
        const k = 1 - laneW * LANES[iu];
        let rr = (r * k + v + 0.5) | 0;
        let gg = (g * k + v + 0.5) | 0;
        let bb = (bl * k + v + 0.5) | 0;
        rr = rr < 0 ? 0 : rr > 255 ? 255 : rr;
        gg = gg < 0 ? 0 : gg > 255 ? 255 : gg;
        bb = bb < 0 ? 0 : bb > 255 ? 255 : bb;
        pixels[rowStart + x] = PIXELS_LITTLE_ENDIAN
          ? ((255 << 24) | (bb << 16) | (gg << 8) | rr) >>> 0
          : ((rr << 24) | (gg << 16) | (bb << 8) | 255) >>> 0;
        r += dr;
        g += dg;
        bl += db;
        u += du;
        al += da;
      }
    }
  };
}
