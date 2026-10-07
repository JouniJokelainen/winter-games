import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants.js';

export function integerScale(viewportWidth, viewportHeight) {
  return Math.max(1, Math.floor(Math.min(viewportWidth / CANVAS_WIDTH, viewportHeight / CANVAS_HEIGHT)));
}

export function createScreen(canvas) {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  function fit() {
    const scale = integerScale(window.innerWidth, window.innerHeight);
    canvas.style.width = `${CANVAS_WIDTH * scale}px`;
    canvas.style.height = `${CANVAS_HEIGHT * scale}px`;
  }
  window.addEventListener('resize', fit);
  fit();
  return ctx;
}
