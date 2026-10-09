import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants.js';
import { PALETTE } from './palette.js';
import { createRng } from './rng.js';
import { drawForestLayer, FAR_FOREST, NEAR_FOREST } from './scenery.js';

// The menu backdrop at the full 640×512 canvas resolution: a misty winter dawn over the venue, seen from
// the snowy plain. Smooth sky gradient, a low sun, two snow-capped ridges lit from the left, haze, the
// distant ski jump with a jumper that rides it in a loop, drifting forests and three layers of snowfall.

const PLAIN_TOP = 436;
const SKY_BAND = 4;
const DRIFT_PX_PER_S = 11; // the near forest (parallax 0.55) drifts ≈6 px/s
const FOREST_CAMERA_Y = 1200;

const JUMP_LEFT = 480; // left edge of the inrun, right of the title menu
const JUMP_BASE_Y = 330; // height of the takeoff table's foot
const JUMPER_LOOP_SECONDS = 7;

const SUN = { x: 120, y: 292 };

function channels(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function toHex(values) {
  return `#${values.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

export function mix(from, to, t) {
  const a = channels(from);
  const b = channels(to);
  return toHex(a.map((value, i) => value + (b[i] - value) * t));
}

function rgba(hex, alpha) {
  return `rgba(${channels(hex).join(', ')}, ${alpha})`;
}

// Sky colour at a canvas row: blue-grey overhead through a soft lilac to a peach glow at the horizon.
export function skyColorAt(y) {
  const t = Math.min(1, Math.max(0, y / PLAIN_TOP));
  if (t < 0.55) return mix(PALETTE.dawnTop, PALETTE.dawnMid, t / 0.55);
  return mix(PALETTE.dawnMid, PALETTE.dawnHorizon, (t - 0.55) / 0.45);
}

function drawSky(ctx) {
  for (let y = 0; y < PLAIN_TOP; y += SKY_BAND) {
    ctx.fillStyle = skyColorAt(y + SKY_BAND / 2);
    ctx.fillRect(0, y, CANVAS_WIDTH, Math.min(SKY_BAND, PLAIN_TOP - y));
  }
  ctx.fillStyle = PALETTE.snowMid;
  ctx.fillRect(0, PLAIN_TOP, CANVAS_WIDTH, CANVAS_HEIGHT - PLAIN_TOP);
}

function disc(ctx, cx, cy, radius, color) {
  ctx.fillStyle = color;
  for (let dy = -radius; dy <= radius; dy++) {
    const half = Math.floor(Math.sqrt(radius * radius - dy * dy));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

// A low sun behind the ridges, with a glow made of a few blended rings.
function drawSun(ctx) {
  for (const [radius, strength] of [[112, 0.05], [98, 0.07], [84, 0.09], [70, 0.12], [56, 0.17], [44, 0.24], [34, 0.34], [26, 0.5]]) {
    for (let dy = -radius; dy <= radius; dy++) {
      const half = Math.floor(Math.sqrt(radius * radius - dy * dy));
      ctx.fillStyle = mix(skyColorAt(SUN.y + dy), PALETTE.sunGlow, strength);
      ctx.fillRect(SUN.x - half, SUN.y + dy, half * 2 + 1, 1);
    }
  }
  disc(ctx, SUN.x, SUN.y, 17, PALETTE.sunCore);
}

// Triangle wave 0..1 with period 2: sharp summits and sharp valleys, no flat stretches.
const triangle = (u) => Math.abs((((u % 2) + 2) % 2) - 1);

// Ridge height in pixels at x: a main summit pattern plus a finer one, with a slow swell across the range.
function ridgeHeight(x, { phase, frequency, scale, floor }) {
  const u = (x * frequency) / Math.PI + phase;
  const peaky = 0.8 * (1 - triangle(u)) ** 1.3 + 0.2 * (1 - triangle(u * 2.7 + 0.4));
  const swell = 0.8 + 0.2 * Math.sin(x * frequency * 0.41 + phase * 1.7);
  return floor + scale * peaky * swell;
}

const FAR_RIDGE = {
  parallax: 0.05, baseY: 440, phase: 1.1, frequency: 0.0105, scale: 190, floor: 40, snowLine: 0.42,
  rock: [PALETTE.farRockLit, PALETTE.farRockShade], cap: [PALETTE.capLit, PALETTE.capShade],
};
const NEAR_RIDGE = {
  parallax: 0.12, baseY: 440, phase: 0.2, frequency: 0.0148, scale: 120, floor: 20, snowLine: 0.3,
  rock: [PALETTE.nearRockLit, PALETTE.nearRockShade], cap: [PALETTE.capLit, PALETTE.capShade],
};
const RIDGE_COLUMN = 2;
const FACE_SHARE = 0.6; // the lit/shaded face covers this much of the height; below it the slope fades into foothills

// Faces that look left (towards the sun) are lit, the others stay in shade. The snow line is ragged.
function drawRidge(ctx, ridge, driftX, shiftY = 0) {
  const offset = driftX * ridge.parallax;
  const baseY = ridge.baseY + shiftY;
  for (let sx = 0; sx < CANVAS_WIDTH; sx += RIDGE_COLUMN) {
    const m = sx + offset;
    const height = ridgeHeight(m, ridge);
    const lit = ridgeHeight(m + RIDGE_COLUMN, ridge) >= height;
    const top = Math.round(baseY - height);
    const face = Math.round(height * FACE_SHARE);
    const snow = Math.round(height * ridge.snowLine + 7 * Math.sin(m * 0.11) + 4 * Math.sin(m * 0.27 + 1));
    ctx.fillStyle = ridge.rock[lit ? 0 : 1];
    ctx.fillRect(sx, top, RIDGE_COLUMN, face);
    ctx.fillStyle = mix(mix(ridge.rock[0], ridge.rock[1], 0.5), PALETTE.capShade, 0.55);
    ctx.fillRect(sx, top + face, RIDGE_COLUMN, baseY - top - face);
    ctx.fillStyle = ridge.cap[lit ? 0 : 1];
    ctx.fillRect(sx, top, RIDGE_COLUMN, Math.max(2, Math.min(Math.round(face * 0.85), snow)));
  }
}

// A band of haze: the sky colour fading in over everything behind it.
function drawHaze(ctx, fromY, toY, maxAlpha) {
  for (let y = fromY; y < toY; y += 4) {
    const t = (y - fromY) / (toY - fromY);
    ctx.fillStyle = rgba(PALETTE.dawnHorizon, (maxAlpha * t * t).toFixed(2));
    ctx.fillRect(0, y, CANVAS_WIDTH, 4);
  }
}

function inrunTop(i) {
  return JUMP_BASE_Y - 66 + Math.round(Math.min(i, 86) * 0.7);
}

function drawDistantJump(ctx) {
  const left = JUMP_LEFT;
  const baseY = JUMP_BASE_Y;
  // Landing hill: a snowy slope falling away from the table, with a shaded edge.
  for (let i = 0; i < 150; i++) {
    const top = baseY - 6 + Math.round(i * 0.4);
    ctx.fillStyle = PALETTE.snowDark;
    ctx.fillRect(left + 100 + i, top, 1, 2);
    ctx.fillStyle = PALETTE.snowMid;
    ctx.fillRect(left + 100 + i, top + 2, 1, CANVAS_HEIGHT - top - 2);
  }
  // Concrete pillars under the inrun.
  ctx.fillStyle = PALETTE.concrete2;
  for (const i of [16, 40, 64]) ctx.fillRect(left + i, inrunTop(i) + 5, 3, baseY - inrunTop(i) - 5);
  // Wooden inrun: a 35° ramp curving into the flat takeoff table.
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = PALETTE.wood2;
    ctx.fillRect(left + i, inrunTop(i), 1, 2);
    ctx.fillStyle = PALETTE.wood5;
    ctx.fillRect(left + i, inrunTop(i) + 2, 1, 3);
  }
}

// A tiny jumper: crouched on the inrun, stretched out in flight, gone once it leaves the screen.
function drawJumper(ctx, time) {
  const p = (time % JUMPER_LOOP_SECONDS) / JUMPER_LOOP_SECONDS;
  const RIDE_END = 0.6;
  const FLIGHT_END = 0.8;
  if (p > FLIGHT_END) return;
  let x;
  let y;
  let flying = false;
  if (p < RIDE_END) {
    const i = Math.round(100 * (p / RIDE_END) ** 2);
    x = JUMP_LEFT + i;
    y = inrunTop(i) - 2;
  } else {
    const u = (p - RIDE_END) / (FLIGHT_END - RIDE_END);
    x = JUMP_LEFT + 100 + Math.round(u * 100);
    y = JUMP_BASE_Y - 8 + Math.round(u * 24) - Math.round(Math.sin(Math.PI * u) * 12);
    flying = true;
  }
  const slope = flying ? 0.15 : 0.7;
  ctx.fillStyle = PALETTE.skierSki;
  for (let k = -6; k <= 5; k++) ctx.fillRect(x + k, y + Math.round(slope * k * 0.6), 1, 1);
  if (flying) {
    ctx.fillStyle = PALETTE.skierSuit;
    ctx.fillRect(x - 3, y - 4, 7, 3);
    ctx.fillStyle = PALETTE.helmet;
    ctx.fillRect(x + 4, y - 5, 3, 3);
  } else {
    ctx.fillStyle = PALETTE.skierSuit;
    ctx.fillRect(x - 2, y - 6, 4, 5);
    ctx.fillStyle = PALETTE.helmet;
    ctx.fillRect(x, y - 9, 3, 3);
  }
}

function drawSnowPlain(ctx, time) {
  ctx.fillStyle = PALETTE.snowDark;
  ctx.fillRect(0, PLAIN_TOP, CANVAS_WIDTH, 2);
  ctx.fillStyle = PALETTE.snowLight;
  ctx.fillRect(0, PLAIN_TOP + 2, CANVAS_WIDTH, CANVAS_HEIGHT - PLAIN_TOP - 2);
  ctx.fillStyle = PALETTE.snowMid;
  for (let y = PLAIN_TOP + 16; y < CANVAS_HEIGHT; y += 18) ctx.fillRect(0, y, CANVAS_WIDTH, 1);
  // Glints on the snow crust that blink out of step with each other.
  ctx.fillStyle = PALETTE.white;
  for (let i = 0; i < 28; i++) {
    const rng = createRng(500 + i);
    const x = Math.floor(rng() * CANVAS_WIDTH);
    const y = PLAIN_TOP + 6 + Math.floor(rng() * (CANVAS_HEIGHT - PLAIN_TOP - 10));
    if (Math.sin(time * (1.2 + rng()) + i * 2.1) > 0.55) ctx.fillRect(x, y, 2, 1);
  }
}

// Three layers of snowfall: small and slow far away, big and fast up close.
const SNOW_LAYERS = [
  { count: 70, size: 1, speed: [12, 24], color: PALETTE.snowShadow, seed: 2000 },
  { count: 80, size: 1, speed: [28, 52], color: PALETTE.white, seed: 3000 },
  { count: 36, size: 3, speed: [68, 104], color: PALETTE.white, seed: 4000 },
];

function drawSnow(ctx, time) {
  for (const { count, size, speed, color, seed } of SNOW_LAYERS) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const rng = createRng(seed + i);
      const fall = speed[0] + rng() * (speed[1] - speed[0]);
      const x = (rng() * CANVAS_WIDTH + Math.sin(time * 0.8 + i) * 12 * size + CANVAS_WIDTH) % CANVAS_WIDTH;
      const y = (rng() * CANVAS_HEIGHT + time * fall) % CANVAS_HEIGHT;
      ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
    }
  }
}

// Sky, sun, ridges and haze. `camera` ({ x, y } in canvas pixels) scrolls the ridges with their own parallax;
// the event scenes use this with their camera, the menus with a slow drift.
export function drawDawnScenery(ctx, camera) {
  const shiftY = Math.max(-60, Math.min(60, Math.round((camera.y - FOREST_CAMERA_Y) * 0.05)));
  drawSky(ctx);
  drawSun(ctx);
  drawRidge(ctx, FAR_RIDGE, camera.x, shiftY);
  drawHaze(ctx, 300, 440, 0.6);
  drawRidge(ctx, NEAR_RIDGE, camera.x, shiftY);
}

export function drawVenueBackdrop(ctx, time) {
  const driftX = Math.round(time * DRIFT_PX_PER_S);
  const camera = { x: driftX, y: FOREST_CAMERA_Y };
  drawDawnScenery(ctx, camera);
  drawDistantJump(ctx);
  drawJumper(ctx, time);
  drawForestLayer(ctx, camera, FAR_FOREST);
  drawHaze(ctx, 330, 436, 0.3);
  drawForestLayer(ctx, camera, NEAR_FOREST);
  drawSnowPlain(ctx, time);
  drawSnow(ctx, time);
}
