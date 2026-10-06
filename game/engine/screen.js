import { SCREEN_HEIGHT, SCREEN_WIDTH } from './constants.js';

export function integerScale(viewportWidth, viewportHeight) {
  return Math.max(1, Math.floor(Math.min(viewportWidth / SCREEN_WIDTH, viewportHeight / SCREEN_HEIGHT)));
}

export function createScreen(canvas) {
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  function fit() {
    const scale = integerScale(window.innerWidth, window.innerHeight);
    canvas.style.width = `${SCREEN_WIDTH * scale}px`;
    canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
  }
  window.addEventListener('resize', fit);
  fit();
  return ctx;
}
