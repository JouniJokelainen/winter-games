// The sled with its rider lying head-first on it, seen from behind and above, plus the runner who pushes it at the
// start and hops on at the red line. The figure is an articulated skeleton (lugePose.js) whose joints are projected
// like the track, so perspective and the roll on the wall come for free; the limbs are tapered and shaded with a
// light from the upper left (light / base / dark / deep tones and a rim highlight). Colours of SKIER_STYLES.classic.
import { PALETTE } from '../../engine/palette.js';
import { fillTaperRuns, pixelRuns } from '../../engine/skeleton.js';
import { SKIER_STYLES } from '../skiJump/skier.js';
import { add as offset, GROUND_H, hopPose, lerpPoint as lerpP, liePose, PUSH_GRIP, runPose, SIDE_GRIP, unit } from './lugePose.js';
import { profileHeight, profileSlope, project, SLED_Z } from './lugeProjection.js';

const STYLE = SKIER_STYLES.classic;
const SLED_LENGTH = 1.45;
export const SLED_X_RANGE = 1.9; // metres from the centre line at lateral = ±1
const SCALE = 1.2; // the sled and rider are drawn a little larger than life so they read well
const DECK_H = 0.1; // the deck top above the ice, in sled-local metres (pose h = 0)
const MAX_PUSH_SPEED = 8; // m/s
const BIB_NUMBER = '12';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function mixHex(a, b, t) {
  const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const part = (i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t).toString(16).padStart(2, '0');
  return `#${part(0)}${part(1)}${part(2)}`;
}

// Four tones and a rim highlight for one surface.
function tones(base, dark, { light = 0.22, rim = 0.5, deep = 0.35 } = {}) {
  return {
    rim: mixHex(base, PALETTE.white, rim),
    light: mixHex(base, PALETTE.white, light),
    base,
    dark,
    deep: mixHex(dark, PALETTE.black, deep),
  };
}

const SUIT = tones(STYLE.torso, STYLE.torsoShade);
const LEGS = tones(STYLE.legs, STYLE.legsShade, { light: 0.3, rim: 0.5 });
const PANEL = tones(STYLE.bib.color, mixHex(STYLE.bib.color, PALETTE.steelDark, 0.45), { light: 0.6, rim: 1, deep: 0.25 });
const HELMET = tones(STYLE.helmet.color, STYLE.helmet.shade, { light: 0.25, rim: 0.55 });
const GLOVE = tones(mixHex(STYLE.gloves, PALETTE.black, 0.08), STYLE.helmet.shade, { light: 0.22, rim: 0.45 });
const SHOE = tones('#2a2a2c', '#141416', { light: 0.12, rim: 0.3 });
const SOLE = tones('#4a4d55', PALETTE.slate, { light: 0.15, rim: 0.3 });
const NECK = tones(STYLE.torsoShade, mixHex(STYLE.torsoShade, PALETTE.black, 0.4), { light: 0.12, rim: 0.3 });
const STRIPE = mixHex(PALETTE.white, STYLE.helmet.color, 0.12);
const STRIPE_SHADE = mixHex(PALETTE.white, STYLE.helmet.shade, 0.45);
const SPECULAR = mixHex(PALETTE.white, STYLE.helmet.color, 0.05);
const SHADOW = 'rgba(20, 22, 30, 0.22)';

// Light from the upper left of the screen and toward the viewer.
const LIGHT_X = -0.7;
const LIGHT_Y = -0.5;
const LIGHT_Z = 0.5;

function toneOf(set, brightness) {
  if (brightness > 0.66) return set.light;
  if (brightness > 0.28) return set.base;
  if (brightness > -0.12) return set.dark;
  return set.deep;
}

// Cylinder shading for a limb drawn from screen point a to b: `across` -1 … 1 maps to a surface normal.
function cylinder(set, ax, ay, bx, by, decorate) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const facing = (-(by - ay) / len) * LIGHT_X + ((bx - ax) / len) * LIGHT_Y;
  return (across, t) => {
    const lit = across * facing;
    const brightness = lit + Math.sqrt(Math.max(0, 1 - across * across)) * LIGHT_Z;
    if (decorate) {
      const color = decorate(across, t, brightness);
      if (color) return color;
    }
    if (Math.abs(across) > 0.8 && lit > 0.25) return set.rim;
    return toneOf(set, brightness);
  };
}

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

// `place(x, h, z)` maps sled-local metres (h above the ice) to a world point. The sled sits on the surface of the
// trough at its lateral position and rolls with the slope of the wall under it.
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

// Drawing helpers bound to one placer: `at` projects a pose point (h above the deck) to [x, y, pixels per metre].
function painter(ctx, look, place) {
  const at = (p) => {
    const w = place(p.x, p.h + DECK_H, p.z);
    const [x, y, m] = project(look, w.x, w.h, w.z);
    return [x, y, m * SCALE];
  };
  const taper = (a, b, ra, rb, set, decorate) => {
    const pa = at(a);
    const pb = at(b);
    fillTaperRuns(ctx, pa[0], pa[1], pb[0], pb[1], ra * pa[2], rb * pb[2], cylinder(set, pa[0], pa[1], pb[0], pb[1], decorate));
    return [pa, pb];
  };
  const ellipse = (cx, cz, halfX, halfZ, h, color) => {
    const points = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const p = at({ x: cx + halfX * Math.cos(a), h, z: cz + halfZ * Math.sin(a) });
      points.push([p[0], p[1]]);
    }
    fillPolygon(ctx, points, color);
  };
  return { at, taper, ellipse };
}

const P = (x, h, z) => ({ x, h, z });

// ---- the sled -----------------------------------------------------------------------------------

const WOOD = tones(PALETTE.wood2, PALETTE.wood5, { light: 0.0, rim: 0.25 });
const STEEL = tones(PALETTE.steel, PALETTE.steelDark, { light: 0.3, rim: 0.6 });

function drawSled(ctx, draw, handles) {
  const { at, taper } = draw;
  for (const side of [-1, 1]) {
    taper(P(side * 0.3, -0.07, -0.05), P(side * 0.3, -0.07, SLED_LENGTH), 0.035, 0.035, STEEL);
    taper(P(side * 0.3, -0.07, SLED_LENGTH), P(side * 0.29, 0.08, SLED_LENGTH + 0.22), 0.032, 0.026, STEEL);
  }
  const deck = [[-0.34, 0], [0.34, 0], [0.34, SLED_LENGTH], [-0.34, SLED_LENGTH]].map(([x, z]) => at(P(x, 0, z)));
  fillPolygon(ctx, deck, PALETTE.wood4);
  // A lighter seat pan in the middle of the deck.
  const pan = [[-0.24, 0.05], [0.24, 0.05], [0.22, SLED_LENGTH - 0.12], [-0.22, SLED_LENGTH - 0.12]].map(([x, z]) => at(P(x, 0.005, z)));
  fillPolygon(ctx, pan, PALETTE.wood3);
  for (const side of [-1, 1]) taper(P(side * 0.34, 0.01, 0), P(side * 0.34, 0.01, SLED_LENGTH), 0.04, 0.04, WOOD);
  // Steering handles on the sides of the deck, where the rider's hands grip them.
  for (const side of [-1, 1]) {
    taper(P(side * 0.32, 0.0, SIDE_GRIP.z), P(side * SIDE_GRIP.x, SIDE_GRIP.h, SIDE_GRIP.z), 0.018, 0.018, STEEL);
  }
  // Rear push handles: they fold down as the rider hops on (`handles` 1 = up, 0 = folded).
  if (handles > 0) {
    for (const side of [-1, 1]) {
      const foot = P(side * 0.32, 0.01, 0.06);
      const top = lerpP(foot, P(side * PUSH_GRIP.x, PUSH_GRIP.h, PUSH_GRIP.z), handles);
      taper(foot, top, 0.022, 0.02, STEEL);
      if (handles > 0.6) taper(top, P(top.x, top.h + 0.05, top.z - 0.02), 0.03, 0.026, SHOE); // rubber grip
    }
  }
}

// ---- the athlete --------------------------------------------------------------------------------

const DIGITS = {
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
};

function drawBib(ctx, x, y, scale) {
  const width = BIB_NUMBER.length * 4 * scale - scale;
  const left = Math.round(x - width / 2);
  const top = Math.round(y - (5 * scale) / 2);
  ctx.fillStyle = STYLE.bib.number;
  [...BIB_NUMBER].forEach((digit, i) => {
    DIGITS[digit].forEach((row, r) => {
      for (let c = 0; c < 3; c++) {
        if (row[c] === '#') ctx.fillRect(left + (i * 4 + c) * scale, top + r * scale, scale, scale);
      }
    });
  });
}

// The helmet: a shaded shell with a light stripe down the back, a specular highlight up-left, the visor edge
// wrapping round the sides and a dark rim at the bottom edge. `tilt` rolls it (+ = toward the right).
// The pixels of a row are merged into runs of one colour.
function drawHelmet(target, cx, cy, radius, tilt) {
  const ctx = pixelRuns(target);
  const rx = radius;
  const ry = radius * 1.06;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const minX = Math.floor(cx - ry);
  const maxX = Math.ceil(cx + ry);
  const minY = Math.floor(cy - ry);
  const maxY = Math.ceil(cy + ry);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const u = (dx * cos + dy * sin) / rx; // across the helmet, rolled with the head
      const v = (-dx * sin + dy * cos) / ry; // down the helmet
      const d2 = u * u + v * v;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const brightness = dx / rx * LIGHT_X + dy / ry * LIGHT_Y + nz * LIGHT_Z;
      let color;
      if (v > 0.84) color = HELMET.deep; // bottom edge of the shell
      else if (v > 0.3 && v < 0.56 && Math.abs(u) > 0.6) color = Math.abs(u) > 0.86 && v < 0.46 ? STYLE.helmet.lens : STYLE.helmet.goggles;
      else if ((dx / rx + 0.36) ** 2 + (dy / ry + 0.42) ** 2 < 0.035) color = SPECULAR;
      else if (Math.abs(u) < 0.14 && v < 0.62) color = brightness > 0.3 ? STRIPE : STRIPE_SHADE;
      else if (d2 > 0.8 && brightness > 0.45) color = HELMET.rim;
      else color = toneOf(HELMET, brightness);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.flush();
}

// Direction the sole of a foot faces (pose space): the toe direction turned 90° down in the leg's plane.
const CAMERA_DIR = unit(P(0, 0.45, -0.9));

function drawLeg(draw, hip, knee, ankle, toe) {
  const { at, taper } = draw;
  taper(hip, knee, 0.095, 0.06, LEGS);
  const calf = lerpP(knee, ankle, 0.32);
  // The back of the knee shows as a dark crease where the calf starts.
  taper(knee, calf, 0.058, 0.066, LEGS, (across, t) => (t < 0.14 && Math.abs(across) < 0.6 ? LEGS.deep : null));
  taper(calf, ankle, 0.066, 0.036, LEGS);
  const toeDir = unit(P(toe.x - ankle.x, toe.h - ankle.h, toe.z - ankle.z));
  const soleN = P(0, -toeDir.z, toeDir.h);
  const heel = offset(offset(ankle, toeDir, -0.05), soleN, 0.025);
  taper(heel, toe, 0.05, 0.038, SHOE);
  const facing = soleN.h * CAMERA_DIR.h + soleN.z * CAMERA_DIR.z;
  if (facing > 0.15) {
    // The sole faces the camera: a grey plate with steel spikes under the front of the foot.
    const soleHeel = offset(heel, soleN, 0.035);
    const soleToe = offset(toe, soleN, 0.03);
    taper(soleHeel, soleToe, 0.026, 0.024, SOLE);
    const ctx = draw.ctx;
    for (const t of [0.5, 0.68, 0.86]) {
      for (const side of [-0.022, 0.022]) {
        const p = at(offset(P(soleHeel.x + side, soleHeel.h, soleHeel.z), P(soleToe.x - soleHeel.x, soleToe.h - soleHeel.h, soleToe.z - soleHeel.z), t));
        const size = Math.max(1, Math.round(p[2] * 0.014));
        ctx.fillStyle = PALETTE.steel;
        ctx.fillRect(Math.round(p[0]), Math.round(p[1]), size, size);
      }
    }
  }
}

function drawArm(draw, shoulder, elbow, wrist) {
  const { taper } = draw;
  taper(shoulder, elbow, 0.058, 0.046, SUIT);
  taper(elbow, wrist, 0.046, 0.036, SUIT);
  const hand = offset(wrist, unit(P(wrist.x - elbow.x, wrist.h - elbow.h, wrist.z - elbow.z)), 0.06);
  taper(wrist, hand, 0.042, 0.05, GLOVE);
}

function drawShadow(draw, pose, groundH) {
  const zs = ['toeL', 'toeR', 'ankleL', 'ankleR', 'hip', 'neck', 'head', 'wristL', 'wristR'].map((k) => pose[k].z);
  let zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  // On the deck the shadow ends at the rear of the sled.
  if (groundH > GROUND_H / 2) zMin = Math.max(zMin, 0);
  const cz = (zMin + zMax) / 2;
  const halfZ = (zMax - zMin) / 2 + 0.06;
  // Light from the upper left: the shadow falls a little to the right.
  draw.ellipse(0.06, cz, 0.3, halfZ, groundH, SHADOW);
  draw.ellipse(0.05, cz, 0.2, halfZ * 0.85, groundH, SHADOW);
}

// The whole figure, far to near: shadow, arms, legs (the farther one first), hips and torso with the white back
// panel, seams and bib, the neck and the helmet.
function drawAthlete(ctx, draw, pose, groundH) {
  drawShadow(draw, pose, groundH);
  drawArm(draw, pose.shoulderL, pose.elbowL, pose.wristL);
  drawArm(draw, pose.shoulderR, pose.elbowR, pose.wristR);
  const legs = [
    [pose.hipL, pose.kneeL, pose.ankleL, pose.toeL],
    [pose.hipR, pose.kneeR, pose.ankleR, pose.toeR],
  ].sort((a, b) => b[2].z - a[2].z);
  for (const leg of legs) drawLeg(draw, ...leg);

  // Shoulder caps first: the torso covers the middle of them, so only the rounded deltoids show beside it.
  draw.taper(pose.shoulderL, pose.shoulderR, 0.09, 0.09, SUIT);
  const radiusPx = 0.14 * ((draw.at(pose.hip)[2] + draw.at(pose.neck)[2]) / 2);
  const seamWidth = clamp(1.1 / radiusPx, 0.03, 0.14); // about one pixel
  // The torso ends below the base of the neck so the neck shows between the shoulders and the helmet.
  draw.taper(pose.hip, lerpP(pose.hip, pose.neck, 0.8), 0.12, 0.18, SUIT, (across, t, brightness) => {
    const a = Math.abs(across);
    if (a < 0.44 && t > 0.4 && t < 0.97) {
      if (a > 0.44 - seamWidth || t < 0.4 + seamWidth * 0.5) return SUIT.deep; // piping round the panel
      return toneOf(PANEL, brightness + 0.1);
    }
    if (a < seamWidth * 0.7 && t <= 0.4) return SUIT.deep; // spine seam
    if (a > 0.68 && a < 0.68 + seamWidth * 1.2) return across < 0 ? SUIT.dark : SUIT.deep; // side seams
    return null;
  });
  // Seat: two rounded glutes, wider than the waist, where the legs start.
  for (const [hip, knee] of [[pose.hipL, pose.kneeL], [pose.hipR, pose.kneeR]]) draw.taper(hip, lerpP(hip, knee, 0.18), 0.1, 0.095, LEGS);
  // Bib number in the middle of the back panel.
  const bib = draw.at(lerpP(pose.hip, pose.neck, 0.6));
  drawBib(ctx, bib[0], bib[1], clamp(Math.round(radiusPx / 9), 1, 3));

  draw.taper(pose.neck, lerpP(pose.neck, pose.head, 0.55), 0.055, 0.05, NECK);
  const head = draw.at(pose.head);
  drawHelmet(ctx, head[0], head[1], 0.125 * head[2], pose.headTilt);
}

export function drawSledAndRider(ctx, look, view) {
  const place = makePlacer(view);
  const draw = { ...painter(ctx, look, place), ctx };
  const hopping = view.phase !== 'push' && typeof view.hop === 'number' && view.hop < 1;
  drawSled(ctx, draw, view.phase === 'push' ? 1 : hopping ? Math.max(0, 1 - 2 * view.hop) : 0);
  if (view.phase === 'push') return; // the runner is still pushing: nobody lies on the sled yet
  const pose = hopping ? hopPose(view.hop, view.curve ?? 0) : liePose(view.curve ?? 0);
  drawAthlete(ctx, draw, pose, hopping ? GROUND_H * (1 - view.hop) : 0);
}

// The start-line runner, bent over and pushing the sled by its rear handles. `stride` in [0, 1) is the stride phase.
export function drawRunner(ctx, look, view, stride) {
  const place = makePlacer({ ...view, lateral: 0, bank: 0 });
  const draw = { ...painter(ctx, look, place), ctx };
  const speed01 = clamp((view.speedKmh ?? 0) / 3.6 / MAX_PUSH_SPEED, 0, 1);
  drawAthlete(ctx, draw, runPose(stride, speed01), GROUND_H);
}
