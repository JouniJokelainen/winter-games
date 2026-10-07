import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants.js';
import { PALETTE } from './palette.js';
import { createRng } from './rng.js';

// Landscape layers in the realistic style, drawn at the full 640×512 canvas resolution.
// `camera` is { x, y } in canvas pixels; each layer scrolls with it at its own parallax.

const SKY_BANDS = [PALETTE.mist0, PALETTE.mist1, PALETTE.mist2, PALETTE.mist3, PALETTE.mist4];

export const FAR_FOREST = { parallax: 0.25, spacing: 36, minHeight: 14, maxHeight: 22, baseY: 300, seed: 11 };
export const NEAR_FOREST = { parallax: 0.55, spacing: 68, minHeight: 32, maxHeight: 52, baseY: 350, seed: 23 };

export function drawMistySky(ctx, camera) {
  const bandHeight = CANVAS_HEIGHT / SKY_BANDS.length;
  SKY_BANDS.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, Math.floor(index * bandHeight), CANVAS_WIDTH, Math.ceil(bandHeight));
  });
  // A soft, distant snowy ridge drifting slowly behind everything.
  for (let sx = 0; sx < CANVAS_WIDTH; sx++) {
    const m = sx + camera.x * 0.08;
    const top = Math.round(340 + 44 * Math.sin(m * 0.0055) + 20 * Math.sin(m * 0.0155 + 2) - (camera.y - 1000) * 0.04);
    ctx.fillStyle = PALETTE.snowDark;
    ctx.fillRect(sx, top, 1, CANVAS_HEIGHT - top);
    ctx.fillStyle = PALETTE.snowMid;
    ctx.fillRect(sx, top + 12, 1, CANVAS_HEIGHT - top - 12);
  }
}

export function drawPine(ctx, x, baseY, height) {
  const trunk = Math.max(1, Math.round(height / 6));
  ctx.fillStyle = PALETTE.trunk;
  ctx.fillRect(x - Math.floor(trunk / 2), baseY - trunk * 2, trunk, trunk * 2);
  const crown = height - trunk;
  const tierRows = Math.max(3, Math.round(crown / 4));
  for (let row = 0; row < crown; row++) {
    const tier = (row % tierRows) / tierRows;
    const half = Math.round(((row + 1) / crown) * (height / 3) * (0.6 + 0.4 * tier));
    const y = baseY - trunk * 2 - crown + row;
    ctx.fillStyle = PALETTE.pineDark;
    ctx.fillRect(x - half, y, half * 2 + 1, 1);
    ctx.fillStyle = row % 3 === 0 ? PALETTE.pineLight : PALETTE.pineMid;
    ctx.fillRect(x - half + 1, y, Math.max(1, half), 1);
  }
}

export function drawForestLayer(ctx, camera, { parallax, spacing, minHeight, maxHeight, baseY, seed }) {
  const offset = camera.x * parallax;
  const verticalShift = Math.round((camera.y - 1200) * parallax * 0.25);
  const first = Math.floor(offset / spacing) - 1;
  for (let i = first; i < first + CANVAS_WIDTH / spacing + 3; i++) {
    const rng = createRng(seed + i * 7919);
    const sx = Math.round(i * spacing - offset + rng() * spacing * 0.8);
    const height = Math.round(minHeight + rng() * (maxHeight - minHeight));
    const y = Math.round(baseY + rng() * 60 - verticalShift);
    if (rng() < 0.35) continue;
    drawPine(ctx, sx, y, height);
  }
}

export function drawSnowfall(ctx, time) {
  ctx.fillStyle = PALETTE.white;
  for (let i = 0; i < 140; i++) {
    const rng = createRng(1000 + i);
    const speed = 24 + rng() * 44;
    const x = (rng() * CANVAS_WIDTH + Math.sin(time * 0.8 + i) * 12 + CANVAS_WIDTH) % CANVAS_WIDTH;
    const y = (rng() * CANVAS_HEIGHT + time * speed) % CANVAS_HEIGHT;
    const size = i % 3 === 0 ? 2 : 1;
    ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
  }
}

// ---- menu backdrop: the venue seen from the snowy plain ---------------------------------------

const MENU_DRIFT_PX_PER_S = 11; // the near forest (parallax 0.55) drifts ≈6 px/s
const MENU_CAMERA_Y = 1200;
const JUMP_HOME_X = 480; // left edge of the silhouette, positioned right of the title menu
const JUMP_BASE_Y = 330; // height of the takeoff table's foot
const PLAIN_TOP = 436;

function drawDistantJump(ctx, left, baseY) {
  const inrunTop = (i) => baseY - 66 + Math.round(Math.min(i, 86) * 0.7);
  // Landing hill: a snowy slope falling away from the table.
  for (let i = 0; i < 150; i++) {
    const top = baseY - 6 + Math.round(i * 0.4);
    ctx.fillStyle = PALETTE.snowDark;
    ctx.fillRect(left + 100 + i, top, 1, 1);
    ctx.fillStyle = PALETTE.snowMid;
    ctx.fillRect(left + 100 + i, top + 1, 1, CANVAS_HEIGHT - top - 1);
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

function drawSnowPlain(ctx) {
  ctx.fillStyle = PALETTE.snowDark;
  ctx.fillRect(0, PLAIN_TOP, CANVAS_WIDTH, 2);
  ctx.fillStyle = PALETTE.snowLight;
  ctx.fillRect(0, PLAIN_TOP + 2, CANVAS_WIDTH, CANVAS_HEIGHT - PLAIN_TOP - 2);
  ctx.fillStyle = PALETTE.snowMid;
  for (let y = PLAIN_TOP + 16; y < CANVAS_HEIGHT; y += 18) ctx.fillRect(0, y, CANVAS_WIDTH, 1);
}

export function drawVenueBackdrop(ctx, time) {
  const camera = { x: Math.round(time * MENU_DRIFT_PX_PER_S), y: MENU_CAMERA_Y };
  drawMistySky(ctx, camera);
  drawDistantJump(ctx, JUMP_HOME_X, JUMP_BASE_Y);
  drawForestLayer(ctx, camera, FAR_FOREST);
  drawForestLayer(ctx, camera, NEAR_FOREST);
  drawSnowPlain(ctx);
  drawSnowfall(ctx, time);
}
