// Luge sky: a smooth misty gradient, a dim sun with a glow, three cloud layers and three snow-capped ridges.
// Everything is drawn with whole-pixel fillRects; soft edges come from stacked low-alpha shapes.
import { createRng } from '../../engine/rng.js';
import { W } from './lugeProjection.js';

const SKY_TOP = '#9da1b3';
const SKY_HORIZON = '#d9d7e1';
const HAZE = '#d6d5df';
const SUN_COLOR = '#f3efe6';
const RIDGES = [
  // far to near: lighter and bluer-grey when far
  { par: 0.03, base: 74, amp: 40, seed: 3, body: '#b4bbce', shade: '#a6aec3', cap: '#e8eaf1', step: 3 },
  { par: 0.05, base: 54, amp: 32, seed: 8, body: '#9aa2b8', shade: '#8a92aa', cap: '#dcdfe9', step: 2 },
  { par: 0.08, base: 34, amp: 22, seed: 14, body: '#818aa2', shade: '#717a92', cap: '#d0d4e0', step: 2 },
];
const CLOUD_LAYERS = [
  // far layer: small, pale, slow; near layer: big, darker underside, quicker
  { par: 0.05, drift: 1.2, y: [124, 150], count: 6, rx: [26, 44], ry: [3, 5], light: '#e9e8f0', dark: '#b4b4c4', alpha: 0.5, seed: 21 },
  { par: 0.11, drift: 2.2, y: [88, 120], count: 5, rx: [44, 78], ry: [5, 8], light: '#ecebf2', dark: '#a8a8ba', alpha: 0.6, seed: 22 },
  { par: 0.2, drift: 3.6, y: [58, 92], count: 4, rx: [70, 120], ry: [7, 11], light: '#efeef4', dark: '#9c9cb0', alpha: 0.62, seed: 23 },
];
const CLOUD_PERIOD = W + 360;

const hexCache = new Map();
function channels(hex) {
  let c = hexCache.get(hex);
  if (!c) {
    c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    hexCache.set(hex, c);
  }
  return c;
}

function lerpHex(a, b, t) {
  const ca = channels(a);
  const cb = channels(b);
  const part = (i) => Math.round(ca[i] + (cb[i] - ca[i]) * t).toString(16).padStart(2, '0');
  return `#${part(0)}${part(1)}${part(2)}`;
}

const rgbaCache = new Map();
const rgba = (hex, alpha) => {
  const key = `${hex}${alpha}`;
  let color = rgbaCache.get(key);
  if (color === undefined) {
    const [r, g, b] = channels(hex);
    color = `rgba(${r},${g},${b},${alpha})`;
    rgbaCache.set(key, color);
  }
  return color;
};

// A soft filled ellipse: one rect per row.
function blob(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(1 - (dy / (ry + 0.5)) ** 2));
    if (half > 0) ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2, 1);
  }
}

// Static colour tables, built once per horizon height (the gradient) or at load (the haze, the cap shades).
const gradientCache = new Map();
function gradientColors(horizon) {
  let colors = gradientCache.get(horizon);
  if (!colors) {
    colors = Array.from({ length: horizon }, (_, y) => lerpHex(SKY_TOP, SKY_HORIZON, (y / horizon) ** 1.4));
    gradientCache.set(horizon, colors);
  }
  return colors;
}
const HAZE_COLORS = Array.from({ length: 40 }, (_, i) => rgba(HAZE, (i / 39) ** 1.4 * 0.9));
for (const ridge of RIDGES) ridge.capShade = lerpHex(ridge.cap, ridge.shade, 0.4);

function drawGradient(ctx, horizon) {
  const colors = gradientColors(horizon);
  for (let y = 0; y < horizon; y++) {
    ctx.fillStyle = colors[y];
    ctx.fillRect(0, y, W, 1);
  }
}

function drawSun(ctx, heading) {
  const cx = Math.round(W * 0.68 - heading * 600 * 0.03);
  const cy = 104;
  for (const [r, a] of [[78, 0.05], [58, 0.06], [42, 0.08], [28, 0.1], [18, 0.14]]) blob(ctx, cx, cy, r, Math.round(r * 0.8), rgba(SUN_COLOR, a));
  blob(ctx, cx, cy, 13, 13, rgba(SUN_COLOR, 0.7));
  blob(ctx, cx, cy, 9, 9, rgba('#fbf8f0', 0.55));
}

// Cloud shapes are fixed per layer: built once.
for (const layer of CLOUD_LAYERS) {
  layer.clouds = Array.from({ length: layer.count }, (_, i) => {
    const rng = createRng(layer.seed * 131 + i);
    const rx = Math.round(layer.rx[0] + rng() * (layer.rx[1] - layer.rx[0]));
    const ry = Math.round(layer.ry[0] + rng() * (layer.ry[1] - layer.ry[0]));
    const y = Math.round(layer.y[0] + rng() * (layer.y[1] - layer.y[0]));
    const home = ((i + rng() * 0.8) / layer.count) * CLOUD_PERIOD;
    return { rx, ry, y, home };
  });
}

function drawClouds(ctx, heading, clock) {
  for (const layer of CLOUD_LAYERS) {
    for (const { rx, ry, y, home } of layer.clouds) {
      const raw = home - heading * 600 * layer.par - clock * layer.drift;
      const x = Math.round((((raw % CLOUD_PERIOD) + CLOUD_PERIOD) % CLOUD_PERIOD) - 180);
      // Flat shadowed underside, pale soft body, then a few brighter puffs on top.
      blob(ctx, x, y + Math.round(ry * 0.5), Math.round(rx * 1.08), Math.max(2, Math.round(ry * 0.8)), rgba(layer.dark, layer.alpha * 0.45));
      blob(ctx, x, y, rx, ry, rgba(layer.light, layer.alpha * 0.55));
      blob(ctx, x - Math.round(rx * 0.15), y - Math.round(ry * 0.3), Math.round(rx * 0.7), Math.round(ry * 0.8), rgba(layer.light, layer.alpha * 0.6));
      blob(ctx, x + Math.round(rx * 0.35), y - Math.round(ry * 0.55), Math.round(rx * 0.4), Math.max(2, Math.round(ry * 0.7)), rgba('#ffffff', layer.alpha * 0.35));
    }
  }
}

// Ridged sine sum: pointed peaks, deterministic per ridge.
function ridgeHeight(ridge, m) {
  const p = ridge.seed;
  const a = (1 - Math.abs(Math.sin(m * 0.0125 + p))) ** 1.6;
  const b = (1 - Math.abs(Math.sin(m * 0.0291 + p * 2.3))) ** 1.3;
  const c = 1 - Math.abs(Math.sin(m * 0.0617 + p * 4.1));
  return ridge.base + ridge.amp * (0.6 * a + 0.28 * b + 0.12 * c);
}

// Heights memoised per integer position (the ridges slide in whole pixels anyway).
const TABLE_OFFSET = 8192;
function cachedHeight(ridge, m) {
  const i = m + TABLE_OFFSET;
  if (i < 0 || i >= 2 * TABLE_OFFSET) return ridgeHeight(ridge, m);
  const table = ridge.table ?? (ridge.table = new Float64Array(2 * TABLE_OFFSET).fill(NaN));
  const cached = table[i];
  if (cached === cached) return cached;
  return (table[i] = ridgeHeight(ridge, m));
}

function drawRidges(ctx, heading, horizon) {
  for (const ridge of RIDGES) {
    const shift = Math.round(heading * 600 * ridge.par);
    const capLine = ridge.base + ridge.amp * 0.3; // heights above this carry snow
    for (let sx = 0; sx < W; sx += ridge.step) {
      const m = sx + shift;
      const h = cachedHeight(ridge, m);
      const slope = cachedHeight(ridge, m + 5) - cachedHeight(ridge, m - 5);
      const top = horizon - Math.round(h);
      const width = Math.min(ridge.step, W - sx);
      const bottom = horizon - top;
      ctx.fillStyle = ridge.body;
      ctx.fillRect(sx, top, width, bottom);
      const cap = Math.round((h - capLine) * 1.5 + 2 + 2.5 * Math.sin(m * 0.23) + 2 * Math.sin(m * 0.071));
      // Shadowed flank just under the crest on the side facing away from the sun.
      if (slope < 0) {
        ctx.fillStyle = ridge.shade;
        ctx.fillRect(sx, top, width, Math.min(bottom, Math.max(0, cap) + 6));
      }
      if (cap > 1) {
        ctx.fillStyle = slope < 0 ? ridge.capShade : ridge.cap;
        ctx.fillRect(sx, top, width, Math.min(cap, bottom));
      }
    }
  }
}

// Mist over the lower ridges and the seam to the snow plain.
function drawHaze(ctx, horizon) {
  for (let i = 0; i < 40; i++) {
    const y = horizon - 40 + i;
    ctx.fillStyle = HAZE_COLORS[i];
    ctx.fillRect(0, y, W, 1);
  }
}

export function drawLugeSky(ctx, { heading, clock: rawClock, horizon }, drawForest) {
  const clock = rawClock ?? 0;
  drawGradient(ctx, horizon);
  drawSun(ctx, heading);
  drawClouds(ctx, heading, clock);
  drawRidges(ctx, heading, horizon);
  drawHaze(ctx, horizon);
  drawForest();
}
