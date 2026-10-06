import { formatTime } from '../../core/format.js';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../engine/constants.js';
import { drawBlinking } from '../../engine/draw.js';
import { drawText } from '../../engine/font.js';
import { PALETTE } from '../../engine/palette.js';
import { SLALOM_CONFIG } from './slalomSim.js';

export const SKIER_SCREEN_Y = 70;
export const KMH_PER_PX = 0.35;

const HUD_HEIGHT = 22;
const POLE_HEIGHT = 14;
const LEAN_THRESHOLD = 0.15;

const SPRITE_COLORS = {
  h: PALETTE.red,
  g: PALETTE.black,
  s: PALETTE.skin,
  j: PALETTE.blue,
  p: PALETTE.navy,
  k: PALETTE.yellow,
};

const LEAN_LEFT = [
  '...hhhh.....',
  '..hhhhhh....',
  '..hggggh....',
  '..hssssh....',
  '...ssss.....',
  '.jjjjjjjj...',
  'jjjjjjjjjj..',
  's.jjjjjj.s..',
  's..jjjjjj.s.',
  '...pppppp...',
  '...pppppp...',
  '...pp..pp...',
  '....pp..pp..',
  '....pp..pp..',
  '...kkk..kkk.',
  '...kkk..kkk.',
];

export const SKIER_SPRITES = {
  straight: [
    '....hhhh....',
    '...hhhhhh...',
    '...hggggh...',
    '...hssssh...',
    '....ssss....',
    '..jjjjjjjj..',
    '.jjjjjjjjjj.',
    '.s.jjjjjj.s.',
    '.s.jjjjjj.s.',
    '...pppppp...',
    '...pppppp...',
    '...pp..pp...',
    '...pp..pp...',
    '...pp..pp...',
    '..kkk..kkk..',
    '..kkk..kkk..',
  ],
  left: LEAN_LEFT,
  right: LEAN_LEFT.map((row) => [...row].reverse().join('')),
  fallen: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    'kk..........',
    'kkhhh.......',
    '.hgggjjjjpp.',
    '.hsssjjjjppk',
    '..s..jjjj.pk',
    '.......s...k',
    '............',
  ],
};

const SPECTATOR_COLORS = [PALETTE.red, PALETTE.orange, PALETTE.green, PALETTE.purple, PALETTE.cyan, PALETTE.pink];

export function skierPose(state) {
  if (state.phase === 'disqualified') return 'fallen';
  if (state.angle < -LEAN_THRESHOLD) return 'left';
  if (state.angle > LEAN_THRESHOLD) return 'right';
  return 'straight';
}

function drawSprite(ctx, rows, x, y) {
  rows.forEach((row, rowIndex) => {
    [...row].forEach((code, colIndex) => {
      if (code === '.') return;
      ctx.fillStyle = SPRITE_COLORS[code];
      ctx.fillRect(x + colIndex, y + rowIndex, 1, 1);
    });
  });
}

function drawSnow(ctx, top) {
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.fillStyle = PALETTE.ice;
  for (let worldY = Math.floor(top / 16) * 16; worldY < top + SCREEN_HEIGHT; worldY += 16) {
    ctx.fillRect(0, Math.round(worldY - top), SCREEN_WIDTH, 1);
  }
}

function drawPine(ctx, x, baseY) {
  ctx.fillStyle = PALETTE.pine;
  for (let row = 0; row < 12; row++) {
    const half = Math.floor(row / 3) + 1;
    ctx.fillRect(x - half, baseY - 12 + row, half * 2 + 1, 1);
  }
  ctx.fillStyle = PALETTE.brown;
  ctx.fillRect(x, baseY, 1, 2);
}

function drawSpectator(ctx, x, y, index) {
  ctx.fillStyle = PALETTE.skin;
  ctx.fillRect(x + 1, y, 2, 2);
  ctx.fillStyle = SPECTATOR_COLORS[index % SPECTATOR_COLORS.length];
  ctx.fillRect(x, y + 2, 4, 3);
  ctx.fillStyle = PALETTE.darkGrey;
  ctx.fillRect(x, y + 5, 1, 2);
  ctx.fillRect(x + 3, y + 5, 1, 2);
}

function drawSidelines(ctx, course, top) {
  const firstRow = Math.floor(top / 24) * 24;
  for (let worldY = firstRow; worldY < top + SCREEN_HEIGHT + 24; worldY += 24) {
    const y = Math.round(worldY - top);
    const index = Math.abs(worldY / 24);
    if (index % 2 === 0) {
      drawPine(ctx, 14, y);
      drawPine(ctx, SCREEN_WIDTH - 14, y);
    } else {
      drawSpectator(ctx, 34, y - 6, index);
      drawSpectator(ctx, SCREEN_WIDTH - 38, y - 6, index + 3);
    }
    ctx.fillStyle = index % 2 === 0 ? PALETTE.red : PALETTE.white;
    ctx.fillRect(course.fenceLeftX - 1, y - 6, 2, 6);
    ctx.fillRect(course.fenceRightX - 1, y - 6, 2, 6);
  }
  ctx.fillStyle = PALETTE.grey;
  ctx.fillRect(course.fenceLeftX - 2, 0, 1, SCREEN_HEIGHT);
  ctx.fillRect(course.fenceRightX + 1, 0, 1, SCREEN_HEIGHT);
}

function drawStartAndFinish(ctx, course, top) {
  const hutY = Math.round(course.startY - top - 30);
  if (hutY > -40 && hutY < SCREEN_HEIGHT) {
    ctx.fillStyle = PALETTE.darkRed;
    ctx.fillRect(course.startX - 24, hutY, 48, 6);
    ctx.fillStyle = PALETTE.brown;
    ctx.fillRect(course.startX - 20, hutY + 6, 40, 18);
    ctx.fillStyle = PALETTE.night;
    ctx.fillRect(course.startX - 8, hutY + 12, 16, 12);
  }
  const finishY = Math.round(course.finishY - top);
  if (finishY > -40 && finishY < SCREEN_HEIGHT + 40) {
    for (let x = course.fenceLeftX; x < course.fenceRightX; x += 4) {
      ctx.fillStyle = (x / 4) % 2 === 0 ? PALETTE.black : PALETTE.white;
      ctx.fillRect(x, finishY, 4, 2);
    }
    ctx.fillStyle = PALETTE.darkGrey;
    ctx.fillRect(course.fenceLeftX, finishY - 28, 2, 28);
    ctx.fillRect(course.fenceRightX - 2, finishY - 28, 2, 28);
    ctx.fillStyle = PALETTE.red;
    ctx.fillRect(course.fenceLeftX, finishY - 30, course.fenceRightX - course.fenceLeftX, 10);
    drawText(ctx, 'MAALI', (course.fenceLeftX + course.fenceRightX) / 2, finishY - 28, { align: 'center', color: PALETTE.white });
  }
}

function drawTrack(ctx, track, top) {
  ctx.fillStyle = PALETTE.snowShadow;
  for (const point of track) {
    const y = Math.round(point.y - top);
    if (y >= 0 && y < SCREEN_HEIGHT) {
      ctx.fillRect(Math.round(point.x) - 3, y, 1, 1);
      ctx.fillRect(Math.round(point.x) + 2, y, 1, 1);
    }
  }
}

function drawPole(ctx, pole, status, top) {
  const baseY = Math.round(pole.y - top);
  if (baseY < -POLE_HEIGHT || baseY > SCREEN_HEIGHT + POLE_HEIGHT) return;
  const color = pole.color === 'red' ? PALETTE.red : PALETTE.blue;
  const x = Math.round(pole.x);
  ctx.fillStyle = color;
  if (status.hit) {
    for (let i = 0; i < 10; i++) ctx.fillRect(x + i, baseY - Math.floor(i / 2), 1, 1);
  } else {
    ctx.fillRect(x, baseY - POLE_HEIGHT, 2, POLE_HEIGHT);
    const flagX = pole.side === 'left' ? x - 6 : x + 2;
    ctx.fillRect(flagX, baseY - POLE_HEIGHT, 6, 5);
    ctx.fillStyle = PALETTE.white;
    const arrowTip = pole.side === 'left' ? flagX + 1 : flagX + 4;
    ctx.fillRect(arrowTip, baseY - POLE_HEIGHT + 2, 1, 1);
    ctx.fillRect(flagX + 2, baseY - POLE_HEIGHT + 1, 2, 3);
  }
  if (status.result === 'passed') {
    ctx.fillStyle = PALETTE.green;
    ctx.fillRect(x - 1, baseY + 2, 3, 3);
  } else if (status.result === 'missed') {
    ctx.fillStyle = PALETTE.red;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x - 2 + i, baseY + 2 + i, 1, 1);
      ctx.fillRect(x + 2 - i, baseY + 2 + i, 1, 1);
    }
  }
}

function drawHud(ctx, state, label) {
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, SCREEN_WIDTH, HUD_HEIGHT);
  drawText(ctx, `AIKA ${formatTime(state.time)}`, 4, 3, { color: PALETTE.white });
  drawText(ctx, `${Math.round(state.speed * KMH_PER_PX)} KM/H`, 4, 12, { color: PALETTE.white });
  ctx.fillStyle = PALETTE.darkGrey;
  ctx.fillRect(52, 13, 50, 5);
  ctx.fillStyle = PALETTE.yellow;
  ctx.fillRect(52, 13, Math.round((50 * state.speed) / SLALOM_CONFIG.maxSpeed), 5);
  drawText(ctx, label, SCREEN_WIDTH / 2, 3, { align: 'center', color: PALETTE.skyLight });
  drawText(ctx, `OSUMAT ${state.hits}`, SCREEN_WIDTH - 4, 3, { align: 'right', color: PALETTE.white });
  drawText(ctx, `OHITETUT ${state.missed}/${SLALOM_CONFIG.maxMissed}`, SCREEN_WIDTH - 4, 12, {
    align: 'right',
    color: state.missed > 0 ? PALETTE.orange : PALETTE.white,
  });
}

function drawBanner(ctx, state, time) {
  if (state.phase === 'ready') {
    drawBlinking(ctx, 'VÄLILYÖNTI = LÄHTÖ', SCREEN_WIDTH / 2, 130, time, { color: PALETTE.navy });
  } else if (state.phase === 'finished') {
    drawText(ctx, 'MAALI!', SCREEN_WIDTH / 2, 120, { align: 'center', scale: 2, color: PALETTE.yellow, shadow: PALETTE.darkRed });
  } else if (state.phase === 'disqualified') {
    drawText(ctx, 'HYLÄTTY', SCREEN_WIDTH / 2, 120, { align: 'center', scale: 2, color: PALETTE.red, shadow: PALETTE.black });
  }
}

export function renderSlalom(ctx, { state, track, label, time }) {
  const { course } = state;
  const top = state.y - SKIER_SCREEN_Y;
  drawSnow(ctx, top);
  drawSidelines(ctx, course, top);
  drawStartAndFinish(ctx, course, top);
  drawTrack(ctx, track, top);
  course.poles.forEach((pole, index) => drawPole(ctx, pole, state.poles[index], top));
  drawSprite(ctx, SKIER_SPRITES[skierPose(state)], Math.round(state.x) - 6, SKIER_SCREEN_Y - 14);
  drawHud(ctx, state, label);
  drawBanner(ctx, state, time);
}
