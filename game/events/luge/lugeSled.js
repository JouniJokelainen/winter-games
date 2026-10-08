// The sled with its rider lying head-first on it, seen from behind and above, plus the runner who pushes
// it at the start. Everything is built from world points that are projected like the track, so
// perspective and the roll on the wall come for free. Style C (red helmet, blue suit, white back).
import { PALETTE } from '../../engine/palette.js';
import { fillCapsule, shaded, solid } from '../../engine/skeleton.js';
import { SKIER_STYLES } from '../skiJump/skier.js';
import { profileHeight, profileSlope, project, SLED_Z } from './lugeProjection.js';

const STYLE = SKIER_STYLES.classic;
const SLED_LENGTH = 1.45;
const SLED_X_RANGE = 1.9; // metres from the centre line at lateral = ±1
const SCALE = 1.2; // the sled and rider are drawn a little larger than life so they read well

// Scanline fill of a convex polygon given as [x, y] screen points.
function fillPolygon(ctx, points, color) {
  ctx.fillStyle = color;
  const ys = points.map((p) => p[1]);
  const top = Math.ceil(Math.min(...ys));
  const bottom = Math.floor(Math.max(...ys));
  for (let y = top; y <= bottom; y++) {
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % points.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        const x = ax + ((y - ay) / (by - ay)) * (bx - ax);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    if (maxX >= minX) ctx.fillRect(Math.round(minX), y, Math.max(1, Math.round(maxX) - Math.round(minX)), 1);
  }
}

// `place(x, h, z)` maps sled-local metres to a world point. The sled sits on the surface of the trough at
// its lateral position and rolls with the slope of the wall under it.
function makePlacer(view) {
  const bank = view.bank ?? 0;
  const x0 = view.lateral * SLED_X_RANGE;
  const h0 = profileHeight(x0, bank);
  const roll = -Math.atan(profileSlope(x0, bank));
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  return (x, h, z) => {
    const sx = x * SCALE;
    const sh = h * SCALE;
    return { x: x0 + sx * cos + sh * sin, h: h0 - sx * sin + sh * cos, z: SLED_Z + z * SCALE };
  };
}

function limbDrawer(ctx, look) {
  return (a, b, radius, color) => {
    const pa = project(look, a.x, a.h, a.z);
    const pb = project(look, b.x, b.h, b.z);
    fillCapsule(ctx, pa[0], pa[1], pb[0], pb[1], radius * SCALE * ((pa[2] + pb[2]) / 2), typeof color === 'function' ? color : solid(color));
  };
}

export function drawSledAndRider(ctx, look, view) {
  const place = makePlacer(view);
  const limb = limbDrawer(ctx, look);
  const { legs, legsShade, boots, torso, torsoShade, torsoTop, gloves, helmet } = STYLE;


  // Runners with raised tips, then the wooden deck with its rails.
  for (const side of [-1, 1]) {
    limb(place(side * 0.3, 0.05, -0.05), place(side * 0.3, 0.05, SLED_LENGTH), 0.035, PALETTE.steel);
    limb(place(side * 0.3, 0.05, SLED_LENGTH), place(side * 0.3, 0.2, SLED_LENGTH + 0.22), 0.03, PALETTE.steelDark);
  }
  const deck = [[-0.34, 0], [0.34, 0], [0.34, SLED_LENGTH], [-0.34, SLED_LENGTH]].map(([x, z]) => {
    const p = place(x, 0.12, z);
    return project(look, p.x, p.h, p.z);
  });
  fillPolygon(ctx, deck, PALETTE.wood2);
  for (const side of [-1, 1]) limb(place(side * 0.34, 0.13, 0), place(side * 0.34, 0.13, SLED_LENGTH), 0.04, PALETTE.wood5);

  if (view.phase === 'push') return; // the runner is still pushing: nobody lies on the sled yet

  // Far to near: arms and gloves, head, body, legs, boots.
  for (const side of [-1, 1]) {
    limb(place(side * 0.2, 0.32, 1.0), place(side * 0.3, 0.2, 1.35), 0.065, shaded(torso, torsoShade));
    limb(place(side * 0.3, 0.2, 1.35), place(side * 0.3, 0.2, 1.35), 0.075, gloves);
  }
  limb(place(0, 0.4, 1.17), place(0, 0.4, 1.17), 0.14, shaded(helmet.color, helmet.shade, 0.5));
  limb(place(0, 0.57, 1.14), place(0, 0.57, 1.14), 0.04, helmet.pompom);
  limb(place(0, 0.3, 0.3), place(0, 0.34, 1.0), 0.21, shaded(torso, torsoShade, 0.55));
  limb(place(0, 0.43, 0.38), place(0, 0.46, 1.0), 0.13, torsoTop);
  for (const side of [-1, 1]) {
    limb(place(side * 0.09, 0.3, 0.3), place(side * 0.1, 0.36, -0.1), 0.085, shaded(legs, legsShade));
    limb(place(side * 0.1, 0.36, -0.1), place(side * 0.1, 0.37, -0.22), 0.075, boots);
  }
}

// The start-line runner, bent over and pushing the sled by its rear handles. `stride` in [0, 1) animates the legs.
export function drawRunner(ctx, look, view, stride) {
  const place = makePlacer({ ...view, lateral: 0, bank: 0 });
  const limb = limbDrawer(ctx, look);
  const { legs, legsShade, boots, torso, torsoShade, torsoTop, gloves, helmet } = STYLE;
  const swing = Math.sin(stride * Math.PI * 2);
  const hip = place(0, 0.9, -0.5);
  const shoulder = place(0, 1.18, 0.15);

  // Two legs in opposite phase: one planted close to the sled, the other kicked far behind.
  for (const [side, phase] of [[-1, swing], [1, -swing]]) {
    const reach = 0.5 + 0.5 * phase; // 0 = kicked back, 1 = planted forward
    const knee = place(side * 0.13, 0.5 + 0.18 * (1 - reach), -0.5 - 0.25 + 0.45 * reach);
    const foot = place(side * 0.14, 0.04 + 0.4 * (1 - reach), -0.5 - 0.85 + 1.0 * reach);
    limb(hip, knee, 0.095, shaded(legs, legsShade));
    limb(knee, foot, 0.08, shaded(legs, legsShade));
    limb(foot, { ...foot, z: foot.z + 0.22 * SCALE }, 0.075, boots);
  }
  limb(hip, shoulder, 0.19, shaded(torso, torsoShade, 0.55));
  limb(place(0, 1.0, -0.35), place(0, 1.17, 0.1), 0.12, torsoTop);
  for (const side of [-1, 1]) {
    const hand = place(side * 0.3, 0.5, 0.25);
    limb(place(side * 0.2, 1.12, 0.15), hand, 0.065, shaded(torso, torsoShade));
    limb(hand, hand, 0.075, gloves);
  }
  limb(place(0, 1.33, 0.3), place(0, 1.33, 0.3), 0.14, shaded(helmet.color, helmet.shade, 0.5));
  limb(place(0, 1.5, 0.27), place(0, 1.5, 0.27), 0.04, helmet.pompom);
}
