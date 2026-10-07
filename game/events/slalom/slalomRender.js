import { formatTime } from '../../core/format.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../engine/constants.js';
import { drawBlinking } from '../../engine/draw.js';
import { drawText } from '../../engine/font.js';
import { PALETTE } from '../../engine/palette.js';
import { drawPine, drawSnowfall } from '../../engine/scenery.js';
import { SKIER_STYLES } from '../skiJump/skier.js';
import { SLALOM_CONFIG } from './slalomSim.js';
import { drawSlalomSkier } from './slalomSkier.js';

// Draws at the full 640×512 canvas (SlalomScene.highResolution). The simulation works in world
// pixels (320 wide); WORLD_SCALE maps them to the canvas, so the view covers the same area as before.
export const WORLD_SCALE = 2;
export const SKIER_SCREEN_Y = 70; // world pixels from the top of the view to the skier's boots
export const KMH_PER_PX = 0.35;

const HUD_HEIGHT = 44;
const TEXT_SCALE = 2;
const GROOMER_SPACING = 32;
const SIDE_ROW = 48; // canvas px between pines, spectators and fence posts along the course
const POLE_HEIGHT = 28;
const SPECTATOR_COLORS = [PALETTE.suitPink, PALETTE.guide, PALETTE.wood2, PALETTE.pineLight, PALETTE.concrete1];

const toCanvasX = (x) => Math.round(x * WORLD_SCALE);
const toCanvasY = (y, top) => Math.round((y - top) * WORLD_SCALE);
const wrap = (value, period) => ((value % period) + period) % period;

// ---- slope, track and sides -------------------------------------------------------------------

function drawSlope(ctx, course, offset) {
  const left = toCanvasX(course.fenceLeftX);
  const right = toCanvasX(course.fenceRightX);
  ctx.fillStyle = PALETTE.snowMid;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = PALETTE.snowLight;
  ctx.fillRect(left, 0, right - left, CANVAS_HEIGHT);
  // Groomer lines scrolling with the course.
  ctx.fillStyle = PALETTE.snowMid;
  for (let y = wrap(-offset, GROOMER_SPACING); y < CANVAS_HEIGHT; y += GROOMER_SPACING) {
    ctx.fillRect(left, y, right - left, 1);
  }
}

function drawTrack(ctx, track, top) {
  ctx.fillStyle = PALETTE.trackGroove;
  for (const point of track) {
    const y = toCanvasY(point.y, top);
    if (y < 0 || y >= CANVAS_HEIGHT) continue;
    const x = toCanvasX(point.x);
    ctx.fillRect(x - 7, y, 2, 4);
    ctx.fillRect(x + 5, y, 2, 4);
  }
}

function drawPineWithShadow(ctx, x, baseY, height) {
  ctx.fillStyle = PALETTE.shadow;
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 2 + i * 2, baseY - 1 + i, Math.round(height / 4), 1);
  drawPine(ctx, x, baseY, height);
}

// A spectator in a winter coat and a woolly hat; every third one waves (arm up one second, down one).
function drawSpectator(ctx, x, baseY, index, time) {
  ctx.fillStyle = PALETTE.concrete3;
  ctx.fillRect(x + 1, baseY - 6, 3, 6);
  ctx.fillRect(x + 6, baseY - 6, 3, 6);
  ctx.fillStyle = SPECTATOR_COLORS[index % SPECTATOR_COLORS.length];
  ctx.fillRect(x, baseY - 16, 10, 10);
  if (index % 3 === 0 && Math.floor(time + index * 0.37) % 2 === 0) ctx.fillRect(x + 10, baseY - 24, 2, 9);
  ctx.fillStyle = PALETTE.skin;
  ctx.fillRect(x + 2, baseY - 22, 6, 6);
  ctx.fillStyle = index % 2 === 0 ? PALETTE.red : PALETTE.guide;
  ctx.fillRect(x + 2, baseY - 24, 6, 3);
}

function drawNet(ctx, fenceX, offset) {
  ctx.fillStyle = PALETTE.snowDark;
  ctx.fillRect(fenceX - 1, 0, 2, CANVAS_HEIGHT);
  for (let y = wrap(-offset, 4); y < CANVAS_HEIGHT; y += 4) ctx.fillRect(fenceX - 2, y, 4, 1);
}

function drawFencePost(ctx, fenceX, baseY) {
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(fenceX - 2, baseY - 10, 4, 10);
  ctx.fillStyle = PALETTE.wood6;
  ctx.fillRect(fenceX + 1, baseY - 10, 1, 10);
}

function drawSides(ctx, course, offset, time) {
  const left = toCanvasX(course.fenceLeftX);
  const right = toCanvasX(course.fenceRightX);
  drawNet(ctx, left, offset);
  drawNet(ctx, right, offset);
  const first = Math.floor(offset / SIDE_ROW) - 1;
  for (let i = first; i < first + CANVAS_HEIGHT / SIDE_ROW + 3; i++) {
    const y = i * SIDE_ROW - offset;
    const row = Math.abs(i);
    if (row % 2 === 0) {
      drawPineWithShadow(ctx, 28, y, 44 + (row % 3) * 8);
      drawPineWithShadow(ctx, CANVAS_WIDTH - 28, y, 44 + ((row + 1) % 3) * 8);
    } else {
      drawSpectator(ctx, 72, y, row, time);
      drawSpectator(ctx, CANVAS_WIDTH - 76, y, row + 3, time);
    }
    drawFencePost(ctx, left, y);
    drawFencePost(ctx, right, y);
  }
}

// ---- start and finish ---------------------------------------------------------------------------

function drawStartHut(ctx, course, top) {
  const cx = toCanvasX(course.startX);
  const y = toCanvasY(course.startY, top) - 60;
  if (y < -80 || y > CANVAS_HEIGHT) return;
  ctx.fillStyle = PALETTE.wood8;
  ctx.fillRect(cx - 50, y, 100, 12);
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(cx - 42, y + 12, 84, 36);
  ctx.fillStyle = PALETTE.wood5;
  for (let i = 0; i < 84; i += 8) ctx.fillRect(cx - 42 + i, y + 12, 1, 36);
  ctx.fillStyle = PALETTE.wood8;
  ctx.fillRect(cx - 16, y + 22, 32, 26);
}

function drawFinish(ctx, course, top) {
  const y = toCanvasY(course.finishY, top);
  if (y < -80 || y > CANVAS_HEIGHT + 80) return;
  const left = toCanvasX(course.fenceLeftX);
  const right = toCanvasX(course.fenceRightX);
  for (let x = left; x < right; x += 8) {
    const even = ((x - left) / 8) % 2 === 0;
    ctx.fillStyle = even ? PALETTE.black : PALETTE.paper;
    ctx.fillRect(x, y, 8, 4);
    ctx.fillStyle = even ? PALETTE.paper : PALETTE.black;
    ctx.fillRect(x, y + 4, 8, 4);
  }
  for (const postX of [left, right - 8]) {
    ctx.fillStyle = PALETTE.concrete1;
    ctx.fillRect(postX, y - 56, 8, 56);
    ctx.fillStyle = PALETTE.concrete3;
    ctx.fillRect(postX + 6, y - 56, 2, 56);
  }
  ctx.fillStyle = PALETTE.red;
  ctx.fillRect(left, y - 60, right - left, 20);
  ctx.fillStyle = PALETTE.darkRed;
  ctx.fillRect(left, y - 42, right - left, 2);
  drawText(ctx, 'MAALI', (left + right) / 2, y - 56, { align: 'center', scale: TEXT_SCALE, color: PALETTE.paper });
}

// ---- gates and skier ----------------------------------------------------------------------------

function drawPole(ctx, pole, status, top) {
  const x = toCanvasX(pole.x);
  const baseY = toCanvasY(pole.y, top);
  if (baseY < -POLE_HEIGHT || baseY > CANVAS_HEIGHT + POLE_HEIGHT) return;
  const color = pole.color === 'red' ? PALETTE.red : PALETTE.guide;
  if (status.hit) {
    // Knocked over, lying on the snow.
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(x + i, baseY - Math.floor(i / 3) + 2, 1, 2);
      ctx.fillStyle = color;
      ctx.fillRect(x + i, baseY - Math.floor(i / 3), 1, 3);
    }
  } else {
    ctx.fillStyle = PALETTE.shadow;
    for (let i = 0; i < 14; i++) ctx.fillRect(x + 2 + i, baseY + Math.floor(i / 3), 1, 2);
    ctx.fillStyle = color;
    ctx.fillRect(x - 2, baseY - POLE_HEIGHT, 4, POLE_HEIGHT);
    const flagX = pole.side === 'left' ? x - 14 : x + 2;
    ctx.fillRect(flagX, baseY - POLE_HEIGHT, 12, 10);
    // Arrow towards the side the skier must pass on.
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(flagX + 4, baseY - POLE_HEIGHT + 3, 4, 4);
    ctx.fillRect(pole.side === 'left' ? flagX + 2 : flagX + 8, baseY - POLE_HEIGHT + 4, 2, 2);
  }
  if (status.result === 'passed') {
    ctx.fillStyle = PALETTE.green;
    ctx.fillRect(x - 3, baseY + 4, 6, 6);
  } else if (status.result === 'missed') {
    ctx.fillStyle = PALETTE.red;
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(x - 4 + i, baseY + 4 + i, 2, 2);
      ctx.fillRect(x + 4 - i, baseY + 4 + i, 2, 2);
    }
  }
}

function drawSkierWithShadow(ctx, state) {
  const x = toCanvasX(state.x);
  const y = SKIER_SCREEN_Y * WORLD_SCALE;
  ctx.fillStyle = PALETTE.shadow;
  for (let row = -3; row <= 3; row++) {
    const half = Math.round(16 * Math.sqrt(1 - (row / 4) ** 2));
    ctx.fillRect(x - half + 4, y + 2 + row, half * 2, 1);
  }
  drawSlalomSkier(ctx, SKIER_STYLES.classic, x, y, state.angle, state.phase === 'disqualified');
}

// ---- HUD and banners ----------------------------------------------------------------------------

function drawHud(ctx, state, label) {
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
  drawText(ctx, `AIKA ${formatTime(state.time)}`, 8, 6, { scale: TEXT_SCALE, color: PALETTE.white });
  drawText(ctx, `${Math.round(state.speed * KMH_PER_PX)} KM/H`, 8, 24, { scale: TEXT_SCALE, color: PALETTE.white });
  ctx.fillStyle = PALETTE.darkGrey;
  ctx.fillRect(104, 26, 100, 10);
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(104, 26, Math.round((100 * state.speed) / SLALOM_CONFIG.maxSpeed), 10);
  drawText(ctx, label, CANVAS_WIDTH / 2, 6, { align: 'center', scale: TEXT_SCALE, color: PALETTE.skyLight });
  drawText(ctx, `OSUMAT ${state.hits}`, CANVAS_WIDTH - 8, 6, { align: 'right', scale: TEXT_SCALE, color: PALETTE.white });
  drawText(ctx, `OHITETUT ${state.missed}/${SLALOM_CONFIG.maxMissed}`, CANVAS_WIDTH - 8, 24, {
    align: 'right',
    scale: TEXT_SCALE,
    color: state.missed > 0 ? PALETTE.orange : PALETTE.white,
  });
}

function drawBanner(ctx, state, time) {
  if (state.phase === 'ready') {
    drawBlinking(ctx, 'VÄLILYÖNTI = LÄHTÖ', CANVAS_WIDTH / 2, 260, time, { scale: TEXT_SCALE, color: PALETTE.night });
  } else if (state.phase === 'finished') {
    drawText(ctx, 'MAALI!', CANVAS_WIDTH / 2, 240, { align: 'center', scale: 4, color: PALETTE.guide, shadow: PALETTE.night });
  } else if (state.phase === 'disqualified') {
    drawText(ctx, 'HYLÄTTY', CANVAS_WIDTH / 2, 240, { align: 'center', scale: 4, color: PALETTE.red, shadow: PALETTE.black });
  }
}

export function renderSlalom(ctx, { state, track, label, time }) {
  const { course } = state;
  const top = state.y - SKIER_SCREEN_Y;
  const offset = Math.round(top * WORLD_SCALE);
  drawSlope(ctx, course, offset);
  drawTrack(ctx, track, top);
  drawSides(ctx, course, offset, time);
  drawStartHut(ctx, course, top);
  drawFinish(ctx, course, top);
  course.poles.forEach((pole, index) => drawPole(ctx, pole, state.poles[index], top));
  drawSkierWithShadow(ctx, state);
  drawSnowfall(ctx, time);
  drawHud(ctx, state, label);
  drawBanner(ctx, state, time);
}
