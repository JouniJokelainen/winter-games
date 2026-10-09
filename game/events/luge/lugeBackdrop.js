// Cached luge backdrop. The sky gradient, the sun, the clouds, the three ridges and the two backdrop forest layers
// never change shape: only the heading slides them sideways (and the clock drifts the clouds). Each one is painted
// once into an offscreen canvas (a sprite, or a strip wide enough for the whole heading range of the track) and
// copied per frame with a handful of drawImage calls instead of ≈ 14 000 fillRects. Layer order and alpha are the
// ones of drawLugeSky. Without a canvas factory (tests, node) or outside the cached range, drawCachedBackdrop
// returns false and the caller draws the backdrop directly.
import { drawForestLayer, drawForestMist, FOREST_LAYERS, FOREST_REACH, forestOffset } from './lugeForest.js';
import { W } from './lugeProjection.js';
import {
  CLOUD_LAYERS, cloudX, drawCloud, drawGradient, drawHaze, drawRidge, drawSunAt, RIDGES, ridgeShift, SUN_REACH, sunCenter,
} from './lugeSky.js';

// Canvas makers in order of preference. A maker whose canvas gives no 2d context (or throws) is dropped for good,
// so the next one is tried and a broken kind is not retried for every sprite and frame.
let broken = false; // a canvas kind has failed: a failed build is then remembered instead of retried every frame
const makers = [
  (width, height) => (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : null),
  (width, height) => {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
];

// A transparent offscreen canvas painted once by `paint`, or null when no canvas with a 2d context can be made.
function offscreen(width, height, paint) {
  for (const make of [...makers]) {
    let canvas = null;
    let ctx = null;
    try {
      canvas = make(width, height);
      ctx = canvas?.getContext('2d') ?? null;
    } catch {
      ctx = null;
    }
    if (ctx) {
      paint(ctx);
      return canvas;
    }
    if (canvas) {
      makers.splice(makers.indexOf(make), 1); // it exists but cannot draw: stop using this kind
      broken = true;
    }
  }
  return null;
}

const mod = (a, n) => ((a % n) + n) % n;

function buildCache({ horizon, tint, headingRange: [lo, hi] }) {
  const gradient = offscreen(W, horizon, (ctx) => drawGradient(ctx, horizon));
  if (!gradient) return null;

  const [sunHalfW, sunHalfH] = SUN_REACH;
  const sun = { canvas: offscreen(sunHalfW * 2 + 2, sunHalfH * 2 + 2, (ctx) => drawSunAt(ctx, sunHalfW, sunHalfH)), x: sunHalfW, y: sunHalfH };
  if (!sun.canvas) return null;

  const clouds = CLOUD_LAYERS.map((layer) => layer.clouds.map((cloud) => {
    const x = Math.ceil(cloud.rx * 1.1) + 2;
    const up = Math.ceil(cloud.ry * 1.3) + 3;
    const down = Math.ceil(cloud.ry * 1.4) + 4;
    return { canvas: offscreen(x * 2, up + down + 1, (ctx) => drawCloud(ctx, layer, cloud, x, up)), x, y: up };
  }));
  if (!clouds.every((layer) => layer.every((sprite) => sprite.canvas))) return null;

  // Ridges: one strip per column phase (the columns start at screen x = 0, i.e. at position `shift`).
  const ridges = RIDGES.map((ridge) => {
    const a = ridgeShift(ridge, lo);
    const b = ridgeShift(ridge, hi);
    const min = Math.min(a, b) - ridge.step;
    const max = Math.max(a, b) + ridge.step;
    const height = Math.ceil(ridge.base + ridge.amp) + 1;
    const strips = Array.from({ length: ridge.step }, (_, phase) => {
      const origin = min - mod(min - phase, ridge.step);
      const width = max - origin + W;
      return { canvas: offscreen(width, height, (ctx) => drawRidge(ctx, ridge, origin, height, width)), origin };
    });
    return { ridge, strips, height };
  });
  if (!ridges.every(({ strips }) => strips.every((strip) => strip.canvas))) return null;

  // Forest layers: the offset is fractional and every tree rounds its own position, so each layer gets a strip per
  // quarter pixel of offset (built on first use, or one per frame in advance); the nearest one slid by whole
  // pixels puts almost every tree on exactly the pixel of the direct drawing (the rest are one pixel off).
  const forest = FOREST_LAYERS.map((layer) => {
    const a = forestOffset(layer, lo);
    const b = forestOffset(layer, hi);
    const origin = Math.floor(Math.min(a, b)) - 2;
    const width = Math.ceil(Math.max(a, b)) + 2 - origin + W;
    return { layer, origin, width, strips: [] };
  });
  return { horizon, tint, gradient, sun, clouds, ridges, forest };
}

const FOREST_PHASES = 4;
const FOREST_HEIGHT = FOREST_REACH + 1;

// The strip phase and source x for a forest layer at `offset` (pixels).
function forestSlice(entry, offset) {
  const q = Math.round(offset * FOREST_PHASES);
  const base = Math.floor(q / FOREST_PHASES);
  return { entry, phase: q - base * FOREST_PHASES, x: base - entry.origin };
}

function forestStrip({ entry, phase }, tint) {
  if (entry.strips[phase] === undefined) {
    const { layer, origin, width } = entry;
    // null when it cannot be built: remembered, so it is not retried every frame (the caller then draws directly).
    entry.strips[phase] = offscreen(width, FOREST_HEIGHT, (ctx) => drawForestLayer(ctx, layer, { offset: origin + phase / FOREST_PHASES, horizon: FOREST_REACH, tint, width }));
  }
  return entry.strips[phase];
}

let cache; // the cache, or { horizon, tint, failed: true } after a canvas failure (not retried every frame)

// Draws the whole backdrop from the cache; false when it cannot (then nothing has been drawn).
// `tint` must be the same function on every call: the forest strips are painted with it once.
export function drawCachedBackdrop(ctx, { heading, clock, horizon, tint, headingRange }) {
  if (typeof ctx.drawImage !== 'function') return false;
  if (cache === undefined || cache.horizon !== horizon || cache.tint !== tint) {
    cache = buildCache({ horizon, tint, headingRange }) ?? (broken ? { horizon, tint, failed: true } : undefined);
  }
  if (!cache) return false; // no canvas at all (tests, node): nothing to remember
  if (cache.failed) return false;
  const ridgeSlices = cache.ridges.map(({ ridge, strips }) => {
    const shift = ridgeShift(ridge, heading);
    const strip = strips[mod(shift, ridge.step)];
    return { strip, x: shift - strip.origin };
  });
  const inside = (width, x) => x >= 0 && x + W <= width;
  if (!ridgeSlices.every(({ strip, x }) => inside(strip.canvas.width, x))) return false;
  const forestSlices = cache.forest.map((entry) => forestSlice(entry, forestOffset(entry.layer, heading)));
  if (!forestSlices.every(({ entry, x }) => inside(entry.width, x))) return false;
  const forestCanvases = forestSlices.map((slice) => forestStrip(slice, cache.tint));
  if (!forestCanvases.every(Boolean)) return false;

  ctx.drawImage(cache.gradient, 0, 0);
  const [sx, sy] = sunCenter(heading);
  ctx.drawImage(cache.sun.canvas, sx - cache.sun.x, sy - cache.sun.y);
  CLOUD_LAYERS.forEach((layer, l) => layer.clouds.forEach((cloud, i) => {
    const sprite = cache.clouds[l][i];
    ctx.drawImage(sprite.canvas, cloudX(layer, cloud, heading, clock) - sprite.x, cloud.y - sprite.y);
  }));
  ridgeSlices.forEach(({ strip, x }, i) => {
    const { height } = cache.ridges[i];
    ctx.drawImage(strip.canvas, x, 0, W, height, 0, horizon - height, W, height);
  });
  drawHaze(ctx, horizon);
  forestSlices.forEach(({ x }, i) => {
    ctx.drawImage(forestCanvases[i], x, 0, W, FOREST_HEIGHT, 0, horizon - FOREST_REACH, W, FOREST_HEIGHT);
    if (FOREST_LAYERS[i].name === 'far') drawForestMist(ctx, horizon);
  });
  // Warm-up: paint one not yet used forest strip per frame, so a turn never has to paint several at once.
  const missing = cache.forest.find((entry) => entry.strips.length < FOREST_PHASES || entry.strips.includes(undefined));
  if (missing) forestStrip({ entry: missing, phase: [...Array(FOREST_PHASES).keys()].find((k) => missing.strips[k] === undefined) }, cache.tint);
  return true;
}
