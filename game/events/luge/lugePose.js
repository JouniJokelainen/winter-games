// Articulated poses for the luge athlete: the runner pushing the sled, the hop onto it and the rider lying on it.
//
// Pure: no canvas. A pose is an object of named joint points in sled-local metres { x: right, h: up from the
// deck, z: forward along the sled, 0 = rear end of the deck } (the drawing scales them with the sled), plus
// `headTilt` (radians, + = toward the right) and the torso `roll` (radians, + = right shoulder down).
//
// Model: a 1.8 m athlete with fixed bone lengths (thigh 0.45, shin 0.45, upper arm 0.3, forearm 0.28, torso 0.55,
// neck 0.1). A pose is built by forward kinematics from a small parameter set:
// - the hip centre, the torso pitch (angle above the horizontal, forward) and roll, the neck pitch and head tilt;
// - per leg the thigh angle (from straight down, + = forward), the knee bend (the shin turns back by it) and the
//   foot angle (from straight down, + = forward), all in the sagittal plane of that leg;
// - per arm a wrist target and an elbow pole direction, solved by two-bone IK (the bones keep their length; a
//   target out of reach leaves the arm straight toward it).
// The run cycle drives these parameters with sines; the hop interpolates the parameters (not the joint positions)
// from the running pose to the lying pose along an arc that lifts the hips, so every bone keeps its length.

export const HOP_SECONDS = 0.3;
export const HOP_RUN_PHASE = 0.55; // the left leg is pushing off, the right one swinging forward

const THIGH = 0.45;
const SHIN = 0.45;
const UPPER_ARM = 0.3;
const FOREARM = 0.28;
const TORSO = 0.55;
const NECK_TO_HEAD = 0.2; // neck bone plus the head centre
const FOOT = 0.2;
const HIP_HALF = 0.1;
const SHOULDER_HALF = 0.2;
const SHOULDER_DROP = 0.03; // the shoulder joints sit a little below the base of the neck
const SOLE = 0.05; // ankle joint to the bottom of the shoe

export const GROUND_H = -0.1; // the ice, relative to the deck
export const PUSH_GRIP = { x: 0.27, h: 0.48, z: -0.02 }; // top of the rear push handles
export const SIDE_GRIP = { x: 0.31, h: 0.06, z: 0.45 }; // the steering handles on the sides of the deck: the hands grip them beside the hips
const LEAN_ROLL = (6 * Math.PI) / 180;
const LEAN_HEAD = 0.3;
const HOP_LIFT = 0.35;

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
export const add = (a, b, k = 1) => ({ x: a.x + b.x * k, h: a.h + b.h * k, z: a.z + b.z * k });
const sub = (a, b) => ({ x: a.x - b.x, h: a.h - b.h, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.h * b.h + a.z * b.z;
const length = (a) => Math.sqrt(dot(a, a));
export const scale = (a, k) => ({ x: a.x * k, h: a.h * k, z: a.z * k });
export const unit = (a) => scale(a, 1 / Math.max(length(a), 1e-9));
export const lerpPoint = (a, b, t) => ({ x: lerp(a.x, b.x, t), h: lerp(a.h, b.h, t), z: lerp(a.z, b.z, t) });

// Direction in the sagittal plane at angle `a` from straight down, + = forward.
const sagittal = (a) => ({ x: 0, h: -Math.cos(a), z: Math.sin(a) });

function solveArm(shoulder, target, pole) {
  const toTarget = sub(target, shoulder);
  const u = unit(toTarget);
  const d = clamp(length(toTarget), Math.abs(UPPER_ARM - FOREARM) + 1e-3, UPPER_ARM + FOREARM - 1e-6);
  const along = (UPPER_ARM * UPPER_ARM - FOREARM * FOREARM + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, UPPER_ARM * UPPER_ARM - along * along));
  const bend = unit(add(pole, u, -dot(pole, u)));
  return { elbow: add(add(shoulder, u, along), bend, height), wrist: add(shoulder, u, d) };
}

function legPoints(hipJoint, leg) {
  const knee = add(hipJoint, sagittal(leg.thigh), THIGH);
  const ankle = add(knee, sagittal(leg.thigh - leg.knee), SHIN);
  const toe = add(ankle, sagittal(leg.foot), FOOT);
  return { knee, ankle, toe };
}

function build(p) {
  const torso = { x: 0, h: Math.sin(p.pitch), z: Math.cos(p.pitch) };
  const back = { x: 0, h: Math.cos(p.pitch), z: -Math.sin(p.pitch) };
  const lateral = add(scale({ x: 1, h: 0, z: 0 }, Math.cos(p.roll)), back, -Math.sin(p.roll));
  const neck = add(p.hip, torso, TORSO);
  const shoulderBase = add(neck, torso, -SHOULDER_DROP);
  const shoulderL = add(shoulderBase, lateral, -SHOULDER_HALF);
  const shoulderR = add(shoulderBase, lateral, SHOULDER_HALF);
  const neckDir = { x: 0, h: Math.sin(p.neckPitch), z: Math.cos(p.neckPitch) };
  const head = add(add(neck, neckDir, NECK_TO_HEAD), lateral, NECK_TO_HEAD * Math.sin(p.headTilt));
  const hipL = add(p.hip, { x: -HIP_HALF, h: 0, z: 0 });
  const hipR = add(p.hip, { x: HIP_HALF, h: 0, z: 0 });
  const legL = legPoints(hipL, p.legs[0]);
  const legR = legPoints(hipR, p.legs[1]);
  const armL = solveArm(shoulderL, p.hands[0], p.poles[0]);
  const armR = solveArm(shoulderR, p.hands[1], p.poles[1]);
  return {
    hip: p.hip, hipL, hipR, neck, head, shoulderL, shoulderR,
    elbowL: armL.elbow, elbowR: armR.elbow, wristL: armL.wrist, wristR: armR.wrist,
    kneeL: legL.knee, kneeR: legR.knee, ankleL: legL.ankle, ankleR: legR.ankle, toeL: legL.toe, toeR: legR.toe,
    headTilt: p.headTilt, roll: p.roll,
  };
}

const smooth = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const STRIKE = 0.25; // the foot lands (the thigh is furthest forward)
const PUSH_OFF = 0.62; // the toes leave the ice
const TOE_PITCH = 0.55; // how far the foot rolls onto its toes at the push-off

// One leg of the run cycle at its own phase q: the thigh swings forward and back. In the stance (STRIKE…PUSH_OFF) the
// knee bends just enough to keep the foot on the ice under a hip `hipDrop` above it, and the heel rises onto the toes
// toward the push-off (the knee extends: the push). In the swing the knee folds the heel up behind with the foot
// pointed back, then the leg reaches forward again; the swing starts and ends exactly in the stance pose.
function runLeg(q, speed01, hipDrop) {
  const cycle = ((q % 1) + 1) % 1;
  const thigh = 0.25 + (0.5 + 0.12 * speed01) * Math.sin(TAU * cycle);
  const toePitch = TOE_PITCH * smooth(0.46, PUSH_OFF, cycle);
  const ankleLift = Math.max(SOLE, 0.02 + FOOT * Math.sin(toePitch));
  // The shin points back from the knee to the planted ankle (no over-extension of the knee).
  const reachDown = clamp((hipDrop - ankleLift - THIGH * Math.cos(thigh)) / SHIN, -1, 1);
  const plantedKnee = Math.max(0.15, thigh + Math.acos(reachDown));
  const plantedFoot = Math.PI / 2 - toePitch;
  if (cycle >= STRIKE && cycle <= PUSH_OFF) return { thigh, knee: plantedKnee, foot: plantedFoot };
  const r = (((cycle - PUSH_OFF) % 1) + 1) % 1 / (1 - PUSH_OFF + STRIKE); // 0 at the push-off, 1 at the strike
  const lift = Math.sin(Math.PI * r);
  const knee = Math.max(plantedKnee + 0.25 * lift, 0.3 + 1.7 * Math.sin(Math.PI * r ** 0.7));
  const foot = lerp(plantedFoot, thigh - knee + Math.PI / 2 - 0.6, 0.9 * Math.sin(Math.PI * r ** 0.6));
  return { thigh, knee, foot };
}

const RUN_HIP_DROP = 0.8; // hip above the ice

function runParams(phase, speed01) {
  const v = clamp(speed01, 0, 1);
  const drop = RUN_HIP_DROP - 0.04 * v + 0.02 * Math.cos(TAU * 2 * (phase - 0.4));
  const legs = [runLeg(phase, v, drop), runLeg(phase + 0.5, v, drop)];
  // The hip never lets a foot sink into the ice.
  let lowest = Infinity;
  for (const leg of legs) {
    const { ankle, toe } = legPoints({ x: 0, h: 0, z: 0 }, leg);
    lowest = Math.min(lowest, ankle.h - SOLE, toe.h - 0.02);
  }
  const hipH = Math.max(GROUND_H + drop, GROUND_H - lowest);
  // Torso pitch above the horizontal: about 40° when walking off, bent further forward (28°) at full push speed. The
  // hip stays at the distance from the push handles that gives a comfortable reach with slightly bent arms.
  const pitch = ((40 - 12 * v) * Math.PI) / 180 + 0.025 * Math.sin(TAU * 2 * phase);
  const reach = 0.53;
  const shoulderH = hipH + (TORSO - SHOULDER_DROP) * Math.sin(pitch);
  const dx = SHOULDER_HALF - PUSH_GRIP.x;
  const dh = shoulderH - PUSH_GRIP.h;
  const dz = Math.sqrt(Math.max(0, reach * reach - dx * dx - dh * dh));
  const hipZ = PUSH_GRIP.z - dz - (TORSO - SHOULDER_DROP) * Math.cos(pitch);
  return {
    hip: { x: 0, h: hipH, z: hipZ },
    pitch,
    roll: 0,
    neckPitch: 0.85,
    headTilt: 0,
    legs,
    hands: [{ ...PUSH_GRIP, x: -PUSH_GRIP.x }, { ...PUSH_GRIP }],
    poles: [{ x: -0.35, h: 0.25, z: -1 }, { x: 0.35, h: 0.25, z: -1 }],
  };
}

function lieParams(curve) {
  const c = clamp(curve, -1, 1);
  const leg = { thigh: -Math.PI / 2 + 0.02, knee: 0.28, foot: -Math.PI / 2 + 0.15 };
  return {
    hip: { x: 0, h: 0.15, z: 0.48 },
    pitch: 0.06,
    roll: LEAN_ROLL * c,
    neckPitch: 0.65,
    headTilt: LEAN_HEAD * c,
    legs: [{ ...leg }, { ...leg }],
    hands: [{ ...SIDE_GRIP, x: -SIDE_GRIP.x }, { ...SIDE_GRIP }],
    poles: [{ x: -1, h: 0.3, z: 0 }, { x: 1, h: 0.3, z: 0 }],
  };
}

export function runPose(phase, speed01) {
  return build(runParams(((phase % 1) + 1) % 1, speed01));
}

export function liePose(curve) {
  return build(lieParams(curve));
}

// t in [0, 1]: 0 = the running pose at the red line, 1 = lying on the sled.
export function hopPose(t, curve) {
  const k = clamp(t, 0, 1);
  const a = runParams(HOP_RUN_PHASE, 1);
  const b = lieParams(curve);
  const u = k * k * (3 - 2 * k);
  const mix = (x, y) => lerp(x, y, u);
  const hip = lerpPoint(a.hip, b.hip, u);
  hip.h += HOP_LIFT * Math.sin(Math.PI * k);
  return build({
    hip,
    pitch: mix(a.pitch, b.pitch),
    roll: mix(a.roll, b.roll),
    neckPitch: mix(a.neckPitch, b.neckPitch),
    headTilt: mix(a.headTilt, b.headTilt),
    legs: a.legs.map((leg, i) => ({
      thigh: mix(leg.thigh, b.legs[i].thigh), knee: mix(leg.knee, b.legs[i].knee), foot: mix(leg.foot, b.legs[i].foot),
    })),
    hands: a.hands.map((hand, i) => lerpPoint(hand, b.hands[i], u)),
    poles: a.poles.map((pole, i) => lerpPoint(pole, b.poles[i], u)),
  });
}
