// Skeleton-based ski jumper: limbs are thick capsules, the head a disc, skis separate lines that start
// at the boots. Everything is rasterised per frame in the final angle, so rotation stays crisp.
// Local pose coordinates are pixels at the 640×512 canvas: x forward, y up, boots at (0, 0).
// The bindings sit at the middle of the skis, so tails reach as far behind the boots as tips reach ahead.

import { PALETTE } from '../../engine/palette.js';
import { fillCapsule, shaded, solid, transform } from '../../engine/skeleton.js';

const DEG = Math.PI / 180;

// ---- styles -----------------------------------------------------------------------------------

// Style C ("80s"): red helmet with pompom and goggles, blue suit with a bib, wooden skis.
export const SKIER_STYLES = {
  classic: {
    head: { color: PALETTE.skin },
    helmet: { color: PALETTE.red, shade: PALETTE.darkRed, pompom: PALETTE.red, goggles: PALETTE.skierGoggleFrame, lens: PALETTE.skierLens },
    torsoTop: PALETTE.skierBib,
    torso: PALETTE.skierSuit,
    torsoShade: PALETTE.skierSuitShade,
    arms: PALETTE.skierSuit,
    gloves: PALETTE.red,
    legs: PALETTE.skierLegs,
    legsShade: PALETTE.skierLegsShade,
    boots: PALETTE.skierBoots,
    ski: PALETTE.skierSki,
    skiShade: PALETTE.skierSkiShade,
    bib: { color: PALETTE.skierBib, number: PALETTE.red },
  },
};

// ---- poses (boots at origin, x forward, y up) -------------------------------------------------

export const POSES = {
  // Inrun tuck: thighs nearly level, chest on the knees, arms back alongside the body.
  crouch: {
    ankle: [0, 2], knee: [12, 12], hip: [-5, 16], shoulder: [17, 22], head: [26, 21],
    hand: [-10, 14], skiAngle: 0, skiTail: -38, skiTip: 42, vSpread: 0,
  },
  // V-style flight: straight body from boots to head, arms back by the hips, skis open below the body.
  flight: {
    ankle: [0, 2], knee: [17, 4], hip: [32, 6], shoulder: [54, 8], head: [63, 9],
    hand: [26, 1], skiAngle: -14 * DEG, skiTail: -40, skiTip: 44, vSpread: 6 * DEG,
  },
  // Telemark landing: one foot forward, knees bent, arms out for balance; bindings a bit behind the ski middle.
  telemark: {
    ankle: [8, 2], ankleBack: [-10, 2], knee: [12, 14], kneeBack: [-8, 12], hip: [0, 24],
    shoulder: [2, 42], head: [3, 51], hand: [22, 36], handBack: [-18, 36],
    skiAngle: 0, skiTail: -28, skiTip: 50, vSpread: 0,
  },
};

function drawSkiPair(ctx, x, y, angle, pose, style, startX = 0) {
  const lines = pose.vSpread > 0 ? [-pose.vSpread / 2, pose.vSpread / 2] : [0];
  lines.forEach((spread, index) => {
    const skiAngle = angle + pose.skiAngle + spread;
    const [ox, oy] = transform(x, y, angle, [startX, 0]);
    const [tx, ty] = [ox + Math.cos(skiAngle) * pose.skiTail, oy - Math.sin(skiAngle) * pose.skiTail];
    const [hx, hy] = [ox + Math.cos(skiAngle) * pose.skiTip, oy - Math.sin(skiAngle) * pose.skiTip];
    const shade = index === 0 && lines.length > 1 ? style.skiShade : style.ski;
    fillCapsule(ctx, tx, ty, hx, hy, 1.4, solid(shade));
    // Raised tip.
    const tipLift = transform(hx, hy, skiAngle, [3, 2]);
    fillCapsule(ctx, hx, hy, tipLift[0], tipLift[1], 1.2, solid(shade));
  });
}

// Face, then the helmet over the back of the head, the pompom on top and goggles at the front.
function drawHead(ctx, [hx, hy], angle, style) {
  const { helmet } = style;
  fillCapsule(ctx, hx, hy, hx, hy, 5.2, solid(style.head.color));
  const back = transform(hx, hy, angle, [-1.5, 1.5]);
  fillCapsule(ctx, back[0], back[1], back[0], back[1], 4.6, shaded(helmet.color, helmet.shade, 0.5));
  const top = transform(hx, hy, angle, [-3, 6]);
  fillCapsule(ctx, top[0], top[1], top[0], top[1], 2, solid(helmet.pompom));
  const goggleA = transform(hx, hy, angle, [2, 0.5]);
  const goggleB = transform(hx, hy, angle, [5.5, 0.5]);
  fillCapsule(ctx, goggleA[0], goggleA[1], goggleB[0], goggleB[1], 1.6, solid(helmet.goggles));
  fillCapsule(ctx, goggleB[0] - 0.5, goggleB[1], goggleB[0], goggleB[1], 0.9, solid(helmet.lens));
}

// Draws the skier with the boots at screen (x, y); `angle` rotates the whole pose counter-clockwise.
export function drawSkier(ctx, style, poseName, x, y, angle) {
  const pose = POSES[poseName];
  const at = (point) => transform(x, y, angle, point);
  const [ankle, knee, hip, shoulder, head, hand] = ['ankle', 'knee', 'hip', 'shoulder', 'head', 'hand'].map((k) => at(pose[k]));

  drawSkiPair(ctx, x, y, angle, pose, style);
  if (pose.ankleBack) drawSkiPair(ctx, x, y, angle, pose, style, pose.ankleBack[0] - pose.ankle[0]);

  // Back leg and back arm first (telemark), then the near limbs.
  if (pose.kneeBack) {
    const [ankleBack, kneeBack, handBack] = [at(pose.ankleBack), at(pose.kneeBack), at(pose.handBack)];
    fillCapsule(ctx, hip[0], hip[1], kneeBack[0], kneeBack[1], 3.4, solid(style.legsShade));
    fillCapsule(ctx, kneeBack[0], kneeBack[1], ankleBack[0], ankleBack[1], 3, solid(style.legsShade));
    fillCapsule(ctx, ankleBack[0], ankleBack[1], ankleBack[0] + 3, ankleBack[1], 2.2, solid(style.boots));
    fillCapsule(ctx, shoulder[0], shoulder[1], handBack[0], handBack[1], 2.2, solid(style.torsoShade));
    fillCapsule(ctx, handBack[0], handBack[1], handBack[0], handBack[1], 2.2, solid(style.gloves));
  }
  fillCapsule(ctx, ankle[0], ankle[1], ankle[0] + 3, ankle[1], 2.4, solid(style.boots));
  fillCapsule(ctx, ankle[0], ankle[1], knee[0], knee[1], 3.2, shaded(style.legs, style.legsShade));
  fillCapsule(ctx, knee[0], knee[1], hip[0], hip[1], 3.8, shaded(style.legs, style.legsShade));
  fillCapsule(ctx, hip[0], hip[1], shoulder[0], shoulder[1], 5.2, (across) => {
    if (across < -0.3) return style.torsoTop;
    return across > 0.55 ? style.torsoShade : style.torso;
  });
  if (style.bib) {
    const bibA = at([(pose.hip[0] + pose.shoulder[0]) / 2 - 3, (pose.hip[1] + pose.shoulder[1]) / 2]);
    const bibB = at([(pose.hip[0] + pose.shoulder[0]) / 2 + 3, (pose.hip[1] + pose.shoulder[1]) / 2]);
    fillCapsule(ctx, bibA[0], bibA[1], bibB[0], bibB[1], 2.6, solid(style.bib.color));
    fillCapsule(ctx, (bibA[0] + bibB[0]) / 2, (bibA[1] + bibB[1]) / 2, (bibA[0] + bibB[0]) / 2, (bibA[1] + bibB[1]) / 2, 0.9, solid(style.bib.number));
  }
  fillCapsule(ctx, shoulder[0], shoulder[1], hand[0], hand[1], 2.2, shaded(style.arms, style.torsoShade));
  fillCapsule(ctx, hand[0], hand[1], hand[0], hand[1], 2.3, solid(style.gloves));
  drawHead(ctx, head, angle, style);
}

// Screen-space segments of the skier silhouette for casting a shadow: each ski (tail → tip) and the
// body (boots → head), for the given pose drawn with the boots at (x, y).
export function skierSilhouette(poseName, x, y, angle) {
  const pose = POSES[poseName];
  const spreads = pose.vSpread > 0 ? [-pose.vSpread / 2, pose.vSpread / 2] : [0];
  const skis = spreads.map((spread) => {
    const skiAngle = angle + pose.skiAngle + spread;
    return [
      [x + Math.cos(skiAngle) * pose.skiTail, y - Math.sin(skiAngle) * pose.skiTail],
      [x + Math.cos(skiAngle) * pose.skiTip, y - Math.sin(skiAngle) * pose.skiTip],
    ];
  });
  return { skis, body: [transform(x, y, angle, pose.ankle), transform(x, y, angle, pose.head)] };
}
