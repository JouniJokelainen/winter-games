import { SCREEN_HEIGHT, SCREEN_WIDTH } from './constants.js';
import { drawText } from './font.js';
import { PALETTE } from './palette.js';
import { createRng } from './rng.js';

const HORIZON_Y = 180;
const SKY_BANDS = [PALETTE.night, PALETTE.navy, PALETTE.blue, PALETTE.sky, PALETTE.skyLight];

function mountainHeight(x) {
  return 38 + 22 * Math.sin(x * 0.031) + 12 * Math.sin(x * 0.073 + 1.3);
}

function drawPine(ctx, x, baseY, height) {
  ctx.fillStyle = PALETTE.pine;
  for (let row = 0; row < height; row++) {
    const half = Math.floor((row * 4) / height) + Math.floor(row / 3) % 2;
    ctx.fillRect(x - half, baseY - height + row, half * 2 + 1, 1);
  }
  ctx.fillStyle = PALETTE.brown;
  ctx.fillRect(x, baseY, 1, 2);
}

export function drawWinterBackdrop(ctx) {
  const bandHeight = HORIZON_Y / SKY_BANDS.length;
  SKY_BANDS.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, Math.floor(index * bandHeight), SCREEN_WIDTH, Math.ceil(bandHeight));
  });
  for (let x = 0; x < SCREEN_WIDTH; x++) {
    const height = Math.round(mountainHeight(x));
    ctx.fillStyle = PALETTE.snowShadow;
    ctx.fillRect(x, HORIZON_Y - height, 1, height);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(x, HORIZON_Y - height, 1, Math.min(5, height));
  }
  for (let x = 6; x < SCREEN_WIDTH; x += 23) drawPine(ctx, x, HORIZON_Y - 2, 12 + (x % 3) * 3);
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(0, HORIZON_Y, SCREEN_WIDTH, SCREEN_HEIGHT - HORIZON_Y);
  ctx.fillStyle = PALETTE.ice;
  for (let y = HORIZON_Y + 4; y < SCREEN_HEIGHT; y += 9) ctx.fillRect(0, y, SCREEN_WIDTH, 1);
}

export function drawPanel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.skyLight;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
}

export function drawBlinking(ctx, text, x, y, time, options = {}) {
  if (Math.floor(time * 2) % 2 === 0) drawText(ctx, text, x, y, { align: 'center', ...options });
}

export class Snowfall {
  constructor(count = 60, seed = 7) {
    const rng = createRng(seed);
    this.time = 0;
    this.flakes = Array.from({ length: count }, () => ({
      x: rng() * SCREEN_WIDTH,
      y: rng() * SCREEN_HEIGHT,
      speed: 10 + rng() * 25,
      phase: rng() * Math.PI * 2,
    }));
  }

  update(dt) {
    this.time += dt;
    for (const flake of this.flakes) {
      flake.y += flake.speed * dt;
      if (flake.y > SCREEN_HEIGHT) flake.y -= SCREEN_HEIGHT + 2;
    }
  }

  render(ctx) {
    ctx.fillStyle = PALETTE.white;
    for (const flake of this.flakes) {
      const x = (flake.x + Math.sin(this.time + flake.phase) * 4 + SCREEN_WIDTH) % SCREEN_WIDTH;
      ctx.fillRect(Math.floor(x), Math.floor(flake.y), 1, 1);
    }
  }
}
