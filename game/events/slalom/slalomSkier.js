// Front-view slalom skier (facing the viewer, skiing down the screen), built from the same capsule
// skeleton as the ski jumper. Local pose coordinates are canvas pixels: x right, y up, the boots'
// midpoint at (0, 0). Skis are drawn in screen space; tips point down the screen (towards the viewer).

import { PALETTE } from '../../engine/palette.js';
import { fillCapsule, shaded, solid, transform } from '../../engine/skeleton.js';

const MAX_LEAN = Math.PI / 3;
const BODY_TILT = 0.45; // share of the ski angle the body leans into the turn
const BOOT_SPREAD = 6;
const SKI_TAIL = 10;
const SKI_TIP = 22;
const POLE_BASKETS = [[-15, -2], [15, -2]];

// Standing pose, lowered by `crouch` (0 upright .. 1 deepest knee bend in the hardest turn).
function poseFor(crouch) {
  return {
    ankleL: [-BOOT_SPREAD, 0], ankleR: [BOOT_SPREAD, 0],
    kneeL: [-6, 12 - 2 * crouch], kneeR: [6, 12 - 2 * crouch],
    hipL: [-4, 22 - 4 * crouch], hipR: [4, 22 - 4 * crouch],
    pelvis: [0, 22 - 4 * crouch], neck: [0, 36 - 5 * crouch],
    shoulderL: [-7, 35 - 5 * crouch], shoulderR: [7, 35 - 5 * crouch],
    handL: [-13, 22 - 3 * crouch], handR: [13, 22 - 3 * crouch],
    head: [0, 45 - 5 * crouch],
  };
}

function drawSki(ctx, bx, by, angle, style) {
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  fillCapsule(ctx, bx - dx * SKI_TAIL, by - dy * SKI_TAIL, bx + dx * SKI_TIP, by + dy * SKI_TIP, 1.6, shaded(style.ski, style.skiShade, 0.2));
}

// Face, the helmet over the top of the head, the pompom and the goggles across the eyes.
function drawFrontHead(ctx, [hx, hy], angle, style) {
  const { helmet } = style;
  const at = (point) => transform(hx, hy, angle, point);
  fillCapsule(ctx, hx, hy, hx, hy, 5.2, solid(style.head.color));
  const [left, right] = [at([-2.6, 2.2]), at([2.6, 2.2])];
  fillCapsule(ctx, left[0], left[1], right[0], right[1], 3.8, solid(helmet.color));
  const top = at([0, 6.8]);
  fillCapsule(ctx, top[0], top[1], top[0], top[1], 2, solid(helmet.pompom));
  const [gogglesL, gogglesR] = [at([-3.4, 0]), at([3.4, 0])];
  fillCapsule(ctx, gogglesL[0], gogglesL[1], gogglesR[0], gogglesR[1], 1.5, solid(helmet.goggles));
  for (const side of [-1.8, 1.8]) {
    const lens = at([side, 0]);
    fillCapsule(ctx, lens[0], lens[1], lens[0], lens[1], 0.9, solid(helmet.lens));
  }
}

function drawBody(ctx, style, x, y, angle, crouch) {
  const pose = poseFor(crouch);
  const at = (point) => transform(x, y, angle, point);
  const p = Object.fromEntries(Object.entries(pose).map(([key, point]) => [key, at(point)]));

  // Poles behind the arms: from the gloves down to the baskets beside the boots.
  [[p.handL, at(POLE_BASKETS[0])], [p.handR, at(POLE_BASKETS[1])]].forEach(([hand, basket]) => {
    fillCapsule(ctx, hand[0], hand[1], basket[0], basket[1], 0.8, solid(PALETTE.concrete3));
    fillCapsule(ctx, basket[0], basket[1], basket[0], basket[1], 1.5, solid(PALETTE.concrete2));
  });

  [[p.hipL, p.kneeL, p.ankleL], [p.hipR, p.kneeR, p.ankleR]].forEach(([hip, knee, ankle]) => {
    fillCapsule(ctx, hip[0], hip[1], knee[0], knee[1], 3.6, shaded(style.legs, style.legsShade));
    fillCapsule(ctx, knee[0], knee[1], ankle[0], ankle[1], 3.2, shaded(style.legs, style.legsShade));
    fillCapsule(ctx, ankle[0], ankle[1], ankle[0], ankle[1], 2.6, solid(style.boots));
  });

  fillCapsule(ctx, p.pelvis[0], p.pelvis[1], p.neck[0], p.neck[1], 6.5, shaded(style.torso, style.torsoShade, 0.5));
  const bib = at([0, (pose.pelvis[1] + pose.neck[1]) / 2 + 1]);
  fillCapsule(ctx, bib[0], bib[1], bib[0], bib[1], 3.4, solid(style.bib.color));
  fillCapsule(ctx, bib[0], bib[1], bib[0], bib[1], 1, solid(style.bib.number));

  [[p.shoulderL, p.handL], [p.shoulderR, p.handR]].forEach(([shoulder, hand]) => {
    fillCapsule(ctx, shoulder[0], shoulder[1], hand[0], hand[1], 2.4, shaded(style.arms, style.torsoShade));
    fillCapsule(ctx, hand[0], hand[1], hand[0], hand[1], 2.4, solid(style.gloves));
  });

  drawFrontHead(ctx, p.head, angle, style);
}

// Lying on the snow with the skis crossed.
function drawFallen(ctx, style, x, y) {
  drawSki(ctx, x - 4, y, 0.9, style);
  drawSki(ctx, x + 4, y, -0.9, style);
  drawBody(ctx, style, x + 10, y - 2, 1.45, 0);
}

// Draws the skier with the boots' midpoint at canvas (x, y). `lean` is the ski angle in radians
// (positive = moving right); the body tilts into the turn and the knees bend with it.
export function drawSlalomSkier(ctx, style, x, y, lean, fallen = false) {
  if (fallen) {
    drawFallen(ctx, style, x, y);
    return;
  }
  const clamped = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, lean));
  const crouch = Math.abs(clamped) / MAX_LEAN;
  drawSki(ctx, x - BOOT_SPREAD, y, clamped, style);
  drawSki(ctx, x + BOOT_SPREAD, y, clamped, style);
  drawBody(ctx, style, x, y, -clamped * BODY_TILT, crouch);
}
