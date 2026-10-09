import { CANVAS_HEIGHT } from '../../engine/constants.js';
import { PALETTE } from '../../engine/palette.js';
import { createRng } from '../../engine/rng.js';

// Small snow mounds: purely graphic, they never affect the run. Each is a bright dome with a crisp blue
// crease on the side away from the low dawn sun (right and below). They sit under the ski track, the poles
// and the skier.

const WORLD_SCALE = 2; // world pixels to canvas pixels, as in slalomRender
const START_CLEAR = 140; // world px from the start with no mounds (the hut)
const FINISH_CLEAR = 150; // world px before the finish line with no mounds
const SPACING = 80; // world px between mounds along the course
const SEED = 7;

// Mounds are in world pixels: centre (x, y) and radii. `outside` ones lie beyond the fences and are fainter.
export function buildMounds(course, seed = SEED) {
  const rng = createRng(seed);
  const mounds = [];
  let index = 0;
  for (let y = START_CLEAR; y < course.finishY - FINISH_CLEAR; y += SPACING * (0.7 + rng() * 0.6)) {
    const radius = 9 + rng() * 13;
    const margin = radius + 4;
    const span = course.fenceRightX - course.fenceLeftX - 2 * margin;
    mounds.push({ x: course.fenceLeftX + margin + rng() * span, y, rx: radius, ry: radius * (0.42 + rng() * 0.16), outside: false });
    const left = index % 2 === 0;
    const outsideRadius = 7 + rng() * 8;
    const room = left ? course.fenceLeftX : 320 - course.fenceRightX;
    const offset = Math.max(outsideRadius, Math.min(room - outsideRadius, rng() * room));
    const outsideY = y + SPACING * 0.45;
    if (outsideY < course.finishY - FINISH_CLEAR) {
      mounds.push({ x: left ? offset : 320 - offset, y: outsideY, rx: outsideRadius, ry: outsideRadius * 0.5, outside: true });
    }
    index++;
  }
  return mounds;
}

function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.floor(rx * Math.sqrt(1 - (dy / ry) ** 2));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

export function drawMounds(ctx, mounds, top) {
  for (const mound of mounds) {
    const cx = Math.round(mound.x * WORLD_SCALE);
    const cy = Math.round((mound.y - top) * WORLD_SCALE);
    const rx = Math.round(mound.rx * WORLD_SCALE);
    const ry = Math.round(mound.ry * WORLD_SCALE);
    if (cy + ry < 0 || cy - ry > CANVAS_HEIGHT) continue;
    // The crease is the same dome shifted to the lower right; the bright dome then covers most of it.
    ellipse(ctx, cx + Math.max(2, Math.round(rx * 0.2)), cy + Math.max(2, Math.round(ry * 0.35)), rx, ry, PALETTE.dawnSnowCrease);
    ellipse(ctx, cx, cy, rx, ry, PALETTE.dawnSnowBright);
  }
}
