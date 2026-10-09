import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../engine/constants.js';
import { PALETTE } from '../../engine/palette.js';
import { inrunHeightAt } from './hill.js';

// The jump's structures, drawn in side view at 16 px per metre: a steel lattice tower under the inrun, the
// start house with its flags, advertising boards, wind screens and the judges' tower along the landing hill.
// `view` carries the projection helpers of skiJumpRender (toScreen, groundHeightAt, slab geometry).

const BAY_M = 6; // distance between the tower's legs
const LEG_PX = 5;
const BRACE_PX = 3;
const LEVEL_PX = 112; // target height between the horizontal chords
const WIND_NET = 'rgba(235, 240, 250, 0.22)';
const WIND_NET_LINE = 'rgba(120, 130, 160, 0.55)';
const FOOTING = { width: 14, height: 9 };

const FLAG_COLORS = [
  [PALETTE.skierBib, PALETTE.guide, PALETTE.skierBib],
  [PALETTE.red, PALETTE.skierBib, PALETTE.guide],
  [PALETTE.black, PALETTE.red, PALETTE.yellow],
];
const BOARD_COLORS = [PALETTE.boardBlue, PALETTE.boardWhite, PALETTE.boardRed, PALETTE.boardGreen];

function onScreen(left, right) {
  return right >= 0 && left <= CANVAS_WIDTH;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// One tower leg: a steel post lit on the left, with a concrete footing where it meets the ground.
function drawLeg(ctx, sx, top, bottom) {
  const visibleTop = Math.max(top, -4);
  const visibleBottom = Math.min(bottom, CANVAS_HEIGHT);
  if (visibleBottom > visibleTop) {
    ctx.fillStyle = PALETTE.steelLit;
    ctx.fillRect(sx - 2, visibleTop, 2, visibleBottom - visibleTop);
    ctx.fillStyle = PALETTE.steelMid;
    ctx.fillRect(sx, visibleTop, 2, visibleBottom - visibleTop);
    ctx.fillStyle = PALETTE.steelDark;
    ctx.fillRect(sx + 2, visibleTop, 1, visibleBottom - visibleTop);
  }
  if (bottom - FOOTING.height < CANVAS_HEIGHT && bottom > 0) {
    ctx.fillStyle = PALETTE.concrete1;
    ctx.fillRect(sx - FOOTING.width / 2, bottom - FOOTING.height, FOOTING.width, FOOTING.height);
    ctx.fillStyle = PALETTE.concrete3;
    ctx.fillRect(sx - FOOTING.width / 2, bottom - 2, FOOTING.width, 2);
  }
}

// A brace between two screen points, drawn column by column.
function drawBrace(ctx, x0, y0, x1, y1, color) {
  ctx.fillStyle = color;
  const left = Math.max(0, Math.min(x0, x1));
  const right = Math.min(CANVAS_WIDTH, Math.max(x0, x1));
  for (let sx = left; sx < right; sx++) {
    const t = (sx - x0) / (x1 - x0);
    const sy = Math.round(lerp(y0, y1, t));
    if (sy > -BRACE_PX && sy < CANVAS_HEIGHT) ctx.fillRect(sx, sy, 1, BRACE_PX);
  }
}

// Steel lattice under the inrun and the takeoff table: legs every BAY_M, crossing diagonals and horizontal
// chords between them. The tower's top follows the underside of the inrun slab.
export function drawTower(ctx, state, camera, view) {
  const { hill } = state;
  const firstX = hill.inrunStart.x - view.PLATFORM_PX / view.PX_PER_M;
  const bays = Math.ceil((0 - firstX) / BAY_M);
  const topAt = (x) => view.toScreen(camera, x, inrunHeightAt(hill, x)).sy + view.SLAB_BOTTOM - 4;
  const bottomAt = (x) => view.toScreen(camera, x, view.groundHeightAt(hill, x)).sy;
  for (let bay = 0; bay < bays; bay++) {
    const xa = firstX + bay * BAY_M;
    const xb = Math.min(0, xa + BAY_M);
    const sxa = view.toScreen(camera, xa, 0).sx;
    const sxb = view.toScreen(camera, xb, 0).sx;
    if (!onScreen(sxa - LEG_PX, sxb + LEG_PX)) continue;
    const topA = topAt(xa);
    const topB = topAt(xb);
    const botA = bottomAt(xa);
    const botB = bottomAt(xb);
    const levels = Math.max(1, Math.round(Math.max(botA - topA, botB - topB) / LEVEL_PX));
    for (let level = 1; level < levels; level++) {
      const f = level / levels;
      drawBrace(ctx, sxa, Math.round(lerp(topA, botA, f)), sxb, Math.round(lerp(topB, botB, f)), PALETTE.steelMid);
    }
    for (let level = 0; level < levels; level++) {
      const f0 = level / levels;
      const f1 = (level + 1) / levels;
      const diagonalUp = (bay + level) % 2 === 0;
      const yA = Math.round(lerp(topA, botA, diagonalUp ? f1 : f0));
      const yB = Math.round(lerp(topB, botB, diagonalUp ? f0 : f1));
      drawBrace(ctx, sxa, yA, sxb, yB, PALETTE.steelDark);
    }
    drawLeg(ctx, sxa, topA, botA);
    if (xb === 0) drawLeg(ctx, sxb, topB, botB);
  }
  drawTableShadow(ctx, state, camera, view);
}

// The tower's shadow on the snow in front of the takeoff table, fading out with distance.
function drawTableShadow(ctx, state, camera, view) {
  const right = view.toScreen(camera, -1, 0).sx;
  for (let sx = Math.max(0, right); sx < Math.min(CANVAS_WIDTH, right + 140); sx++) {
    const x = (sx + camera.x) / view.PX_PER_M;
    const { sy } = view.toScreen(camera, x, view.groundHeightAt(state.hill, x));
    const depth = Math.max(0, 14 - Math.floor((sx - right) / 10));
    if (depth === 0) continue;
    ctx.fillStyle = PALETTE.dawnShadow;
    ctx.fillRect(sx, sy, 1, depth);
  }
}

function drawFlag(ctx, poleX, topY, colors, wind, time, seed) {
  ctx.fillStyle = PALETTE.steelLit;
  ctx.fillRect(poleX, topY, 2, 44);
  const length = 30;
  const stripe = 5;
  const amplitude = 1 + wind * 5;
  for (let i = 0; i < length; i++) {
    const wave = Math.round(Math.sin(time * 5 + i * 0.45 + seed) * amplitude * (i / length));
    colors.forEach((color, row) => {
      ctx.fillStyle = color;
      ctx.fillRect(poleX + 2 + i, topY + 2 + row * stripe + wave, 1, stripe);
    });
  }
}

// The start house on the platform: steel walls, a glass front, a snowy roof, the red start gate and three
// flags that ripple with the wind (`windLift` 0..1).
export function drawStartHouse(ctx, state, camera, view, windLift, time) {
  const start = view.toScreen(camera, state.hill.inrunStart.x, state.hill.inrunStart.y);
  const x0 = start.sx - view.PLATFORM_PX + 18;
  const x1 = start.sx - 34;
  if (!onScreen(x0 - 10, start.sx + 20)) return;
  const floorY = start.sy + view.FAR_RAIL_TOP;
  const height = 76;
  const top = floorY - height;
  // Walls, with a lit left edge and a shaded right edge.
  ctx.fillStyle = PALETTE.steelMid;
  ctx.fillRect(x0, top, x1 - x0, height);
  ctx.fillStyle = PALETTE.steelLit;
  ctx.fillRect(x0, top, 3, height);
  ctx.fillStyle = PALETTE.steelDark;
  ctx.fillRect(x1 - 3, top, 3, height);
  // Glass front: three panes with frames and a reflected-sky gradient.
  const paneWidth = Math.floor((x1 - x0 - 20) / 3);
  for (let pane = 0; pane < 3; pane++) {
    const px = x0 + 8 + pane * (paneWidth + 2);
    ctx.fillStyle = PALETTE.steelDeep;
    ctx.fillRect(px - 2, top + 14, paneWidth + 4, 40);
    for (let row = 0; row < 36; row += 4) {
      ctx.fillStyle = row < 16 ? PALETTE.glass : PALETTE.glassDark;
      ctx.fillRect(px, top + 16 + row, paneWidth, 4);
    }
  }
  ctx.fillStyle = PALETTE.railRed;
  ctx.fillRect(x0, top + 58, x1 - x0, 4);
  ctx.fillStyle = PALETTE.steelDeep;
  ctx.fillRect(x0, floorY - 8, x1 - x0, 8);
  // Roof with an overhang, a dark fascia and a cap of snow.
  ctx.fillStyle = PALETTE.steelDeep;
  ctx.fillRect(x0 - 8, top - 8, x1 - x0 + 16, 8);
  ctx.fillStyle = PALETTE.snowLight;
  ctx.fillRect(x0 - 6, top - 13, x1 - x0 + 12, 5);
  ctx.fillStyle = PALETTE.snowDark;
  ctx.fillRect(x0 - 6, top - 9, x1 - x0 + 12, 1);
  // Flags on the roof.
  for (let i = 0; i < FLAG_COLORS.length; i++) {
    drawFlag(ctx, x0 + 4 + i * Math.floor((x1 - x0 - 12) / 3), top - 56, FLAG_COLORS[i], windLift, time, i * 1.7);
  }
  // Platform railing and the start gate: red posts with a bar the jumper pushes through.
  ctx.fillStyle = PALETTE.railRed;
  ctx.fillRect(x1 + 6, floorY - 26, start.sx - x1 - 22, 2);
  ctx.fillRect(x1 + 6, floorY - 26, 2, 26);
  ctx.fillRect(start.sx - 14, floorY - 40, 3, 40);
  ctx.fillStyle = PALETTE.skierBib;
  ctx.fillRect(start.sx - 14, floorY - 40, 14, 3);
}

// Advertising boards standing on the snow along the landing hill, following its slope.
export function drawBoards(ctx, state, camera, view) {
  const { hill } = state;
  const widthM = 4;
  const gapM = 1;
  for (let metres = 45, index = 0; metres < hill.outrunEnd - 20; metres += widthM + gapM, index++) {
    const left = view.toScreen(camera, metres, 0).sx;
    if (!onScreen(left, left + widthM * view.PX_PER_M)) continue;
    const color = BOARD_COLORS[index % BOARD_COLORS.length];
    const dark = color === PALETTE.boardWhite ? PALETTE.steelLit : PALETTE.steelDeep;
    for (let sx = Math.max(0, left); sx < Math.min(CANVAS_WIDTH, left + widthM * view.PX_PER_M); sx++) {
      const x = (sx + camera.x) / view.PX_PER_M;
      const { sy } = view.toScreen(camera, x, view.groundHeightAt(hill, x));
      ctx.fillStyle = dark;
      ctx.fillRect(sx, sy - 28, 1, 2);
      ctx.fillStyle = color;
      ctx.fillRect(sx, sy - 26, 1, 20);
      ctx.fillStyle = dark;
      ctx.fillRect(sx, sy - 6, 1, 3);
      if ((sx - left) % 22 < 6) {
        ctx.fillStyle = color === PALETTE.boardWhite ? PALETTE.boardRed : PALETTE.boardWhite;
        ctx.fillRect(sx, sy - 20, 1, 8);
      }
    }
  }
}

// Wind screens: netting on poles above the boards along the upper landing hill.
export function drawWindScreens(ctx, state, camera, view) {
  const { hill } = state;
  const from = 30;
  const to = hill.kPoint + 8;
  const left = Math.max(0, view.toScreen(camera, from, 0).sx);
  const right = Math.min(CANVAS_WIDTH, view.toScreen(camera, to, 0).sx);
  for (let sx = left; sx < right; sx++) {
    const x = (sx + camera.x) / view.PX_PER_M;
    const { sy } = view.toScreen(camera, x, view.groundHeightAt(hill, x));
    ctx.fillStyle = WIND_NET;
    ctx.fillRect(sx, sy - 96, 1, 66);
    if (sx % 3 === 0) {
      ctx.fillStyle = WIND_NET_LINE;
      ctx.fillRect(sx, sy - 96, 1, 66);
    }
    for (let row = 0; row < 66; row += 8) {
      ctx.fillStyle = WIND_NET_LINE;
      ctx.fillRect(sx, sy - 96 + row, 1, 1);
    }
  }
  for (let metres = Math.ceil(from / 8) * 8; metres <= to; metres += 8) {
    const { sx, sy } = view.toScreen(camera, metres, view.groundHeightAt(hill, metres));
    if (sx < -4 || sx > CANVAS_WIDTH) continue;
    ctx.fillStyle = PALETTE.steelMid;
    ctx.fillRect(sx - 1, sy - 104, 3, 78);
  }
}

// The judges' tower beside the landing hill just before the K-point: a concrete base, a glass cabin with
// the judges' desks and a flat roof.
export function drawJudgesTower(ctx, state, camera, view) {
  const { hill } = state;
  const metres = hill.kPoint - 28;
  const { sx, sy } = view.toScreen(camera, metres, view.groundHeightAt(hill, metres));
  const width = 112;
  const left = sx - width / 2;
  if (!onScreen(left, left + width)) return;
  const baseTop = sy - 52;
  ctx.fillStyle = PALETTE.concrete1;
  ctx.fillRect(left, baseTop, width, 52);
  ctx.fillStyle = PALETTE.concrete0;
  ctx.fillRect(left, baseTop, 4, 52);
  ctx.fillStyle = PALETTE.concrete3;
  ctx.fillRect(left + width - 4, baseTop, 4, 52);
  ctx.fillStyle = PALETTE.concrete3;
  for (let row = 14; row < 52; row += 14) ctx.fillRect(left, baseTop + row, width, 1);
  const cabinTop = baseTop - 46;
  ctx.fillStyle = PALETTE.steelDeep;
  ctx.fillRect(left - 6, cabinTop - 6, width + 12, 6);
  ctx.fillStyle = PALETTE.steelDark;
  ctx.fillRect(left, cabinTop, width, 46);
  const panes = 5;
  const paneWidth = Math.floor((width - 12) / panes) - 2;
  for (let i = 0; i < panes; i++) {
    const px = left + 6 + i * (paneWidth + 2);
    for (let row = 0; row < 30; row += 5) {
      ctx.fillStyle = row < 15 ? PALETTE.glass : PALETTE.glassDark;
      ctx.fillRect(px, cabinTop + 6 + row, paneWidth, 5);
    }
    // A judge behind every other pane.
    if (i % 2 === 0) {
      ctx.fillStyle = PALETTE.steelDeep;
      ctx.fillRect(px + 3, cabinTop + 24, paneWidth - 6, 12);
      ctx.fillStyle = PALETTE.skin;
      ctx.fillRect(Math.round(px + paneWidth / 2) - 2, cabinTop + 16, 5, 6);
    }
  }
  ctx.fillStyle = PALETTE.railRed;
  ctx.fillRect(left, cabinTop + 38, width, 3);
  ctx.fillStyle = PALETTE.snowLight;
  ctx.fillRect(left - 4, cabinTop - 10, width + 8, 4);
}
