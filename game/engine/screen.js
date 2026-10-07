import { CANVAS_HEIGHT, CANVAS_WIDTH, SCREEN_HEIGHT, SCREEN_WIDTH } from './constants.js';

export function displaySteps(viewportWidth, viewportHeight) {
  return Math.max(1, Math.floor(Math.min(viewportWidth / SCREEN_WIDTH, viewportHeight / SCREEN_HEIGHT)));
}

export function createScreen(canvas) {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  function fit() {
    const steps = displaySteps(window.innerWidth, window.innerHeight);
    canvas.style.width = `${SCREEN_WIDTH * steps}px`;
    canvas.style.height = `${SCREEN_HEIGHT * steps}px`;
  }
  window.addEventListener('resize', fit);
  fit();
  return ctx;
}
