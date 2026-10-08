// Segment-style pseudo-3D projection for the luge track, drawn at the full 640×512 canvas.
// World units are metres: x right, h up from the track surface, z ahead of the camera. The camera sits
// CAM_H above the track centre line and looks along it; curves shift the road sideways with distance.
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../engine/constants.js';
import { curvatureAt } from './lugeTrack.js';

export const W = CANVAS_WIDTH;
export const H = CANVAS_HEIGHT;
export const HORIZON = 196;
export const FOCAL = 300;
export const CAM_H = 2.4;
export const HALF_W = 2.4; // half the width of the trough, rim to rim
export const WALL_T = 0.4; // width of the ice rim on top of each wall
export const RIM_H = 1.5; // height of the rim above the bottom of the trough on a straight
export const BANK_H = 0.5; // how much a banked turn raises the outer rim and lowers the inner one
export const BANK_FULL_CURVATURE = 0.035; // curvature (1/m) at which the banking is at its maximum
export const SLED_Z = 3.4; // distance from the camera to the rear of the sled
export const HEADING_PX = 600; // pixels the backdrop moves per radian of heading (times the layer parallax)

const STEP = 0.5;
const COUNT = 400;
export const MAX_Z = STEP * COUNT;

// Curvature K[i] and sideways offset L[i] (metres, relative to the camera's heading) of the centre line
// at z = i * STEP ahead of the camera, which stands at track distance s.
export function lookahead(s) {
  const L = new Float32Array(COUNT + 1);
  const K = new Float32Array(COUNT + 1);
  let heading = 0;
  let offset = 0;
  for (let i = 0; i <= COUNT; i++) {
    const k = curvatureAt(s + i * STEP);
    K[i] = k;
    L[i] = offset;
    heading += k * STEP;
    offset += heading * STEP;
  }
  return { L, K };
}

export function sample(table, z) {
  const f = Math.max(0, Math.min(COUNT - 1, z / STEP));
  const i = Math.floor(f);
  return table[i] + (table[i + 1] - table[i]) * (f - i);
}

// World point (x metres from the centre line, h metres above the surface, z metres ahead) to the screen.
export function project(look, x, h, z) {
  const m = FOCAL / z;
  return [W / 2 + (sample(look.L, z) + x) * m, HORIZON + (CAM_H - h) * m, m];
}

// The trough is a U: a flat-ish ice bottom that curves up into steep walls. `bank` in [-1, 1] (positive = right
// turn) tilts the whole cross-section so the outside of the turn is higher than the inside.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function bankFor(curvature) {
  return clamp(curvature / BANK_FULL_CURVATURE, -1, 1);
}

export function profileHeight(x, bank) {
  const u = clamp(x / HALF_W, -1, 1);
  return RIM_H * Math.abs(u) ** 2.4 - bank * BANK_H * u;
}

// dh/dx: negative on the left wall, positive on the right wall.
export function profileSlope(x, bank) {
  if (Math.abs(x) >= HALF_W) return 0;
  const u = x / HALF_W;
  return (RIM_H * 2.4 * Math.abs(u) ** 1.4 * Math.sign(u)) / HALF_W - (bank * BANK_H) / HALF_W;
}
