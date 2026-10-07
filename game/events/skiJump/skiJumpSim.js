import { SKI_JUMP_MAX_DISTANCE } from '../../core/rules.js';
import { hillHeightAt, inrunPointAt } from './hill.js';

const DEG = Math.PI / 180;

// Units: metres and seconds. Angles in radians; the body angle is measured from horizontal.
export const JUMP_CONFIG = {
  gravity: 9.81,
  inrunWindAccel: 0.1,
  maxWind: 4,
  fullWindowCalm: 0.1,
  fullWindowStrong: 0.06,
  earliestTakeoff: 0.5,
  lateTakeoffWindow: 1.0,
  takeoffBoost: 2.6,
  startAngle: 30 * DEG,
  maxAngle: 90 * DEG,
  bestAngle: 45 * DEG,
  driftRate: 6 * DEG,
  controlRate: 40 * DEG,
  gustPerWind: 4 * DEG,
  gustInterval: 0.4,
  lift: 0.0084,
  drag: 0.0084 * 0.51,
  liftMin: 0.9,
  offAngleDrag: 0.2,
  poorLandingGap: 0.5,
  perfectLandingGap: 0.15,
  landedDecel: 8,
  fallenDecel: 15,
};

const ACTIVE_PHASES = new Set(['ready', 'inrun', 'flight']);

export function createJumpState(hill, { wind = 0, rng = Math.random } = {}) {
  return {
    hill,
    wind,
    rng,
    phase: 'ready',
    inrunDistance: 0,
    x: hill.inrunStart.x,
    y: hill.inrunStart.y,
    vx: 0,
    vy: 0,
    speed: 0,
    angle: JUMP_CONFIG.startAngle,
    gust: 0,
    gustTimer: 0,
    time: 0,
    lipTime: null,
    takeoff: null,
    lastLandingPress: null,
    landing: null,
    distance: null,
    events: [],
  };
}

export function isJumpActive(state) {
  return ACTIVE_PHASES.has(state.phase);
}

function fullWindow(wind) {
  const C = JUMP_CONFIG;
  const strength = Math.min(1, Math.max(0, wind / C.maxWind));
  return C.fullWindowCalm - (C.fullWindowCalm - C.fullWindowStrong) * strength;
}

export function takeoffQuality(timeToLip, wind) {
  const window = fullWindow(wind);
  if (timeToLip <= window) return 1;
  if (timeToLip >= JUMP_CONFIG.earliestTakeoff) return 0;
  return 1 - (timeToLip - window) / (JUMP_CONFIG.earliestTakeoff - window);
}

// 1 at the best angle (45°), falling to 0 at 0° and 90°.
export function angleEfficiency(angle) {
  return Math.max(0, Math.cos(2 * (angle - JUMP_CONFIG.bestAngle)));
}

export function classifyLanding(gap, late) {
  const C = JUMP_CONFIG;
  if (late || gap === null || gap < C.perfectLandingGap) return 'fall';
  if (gap > C.poorLandingGap) return 'poor';
  return 'perfect';
}

function launch(state) {
  const angle = state.hill.lipAngle;
  const boost = JUMP_CONFIG.takeoffBoost * (state.takeoff?.quality ?? 0);
  state.vx = state.speed * Math.cos(angle) - Math.sin(angle) * boost;
  state.vy = state.speed * Math.sin(angle) + Math.cos(angle) * boost;
  state.x = 0;
  state.y = 0;
  state.phase = 'flight';
  state.lipTime = state.time;
  state.events.push({ type: 'lip' });
}

function stepInrun(state, controls, dt) {
  const { hill } = state;
  if (controls.presses > 0 && !state.takeoff) {
    const timeToLip = (hill.inrunLength - state.inrunDistance) / Math.max(state.speed, 0.1);
    // Presses before the takeoff zone are ignored, so the player can still time the real one.
    if (timeToLip < JUMP_CONFIG.earliestTakeoff) {
      const quality = takeoffQuality(timeToLip, state.wind);
      state.takeoff = { quality, late: false };
      state.events.push({ type: 'takeoff', quality });
    }
  }
  state.speed += (JUMP_CONFIG.gravity * Math.sin(hill.inrunAngle) + JUMP_CONFIG.inrunWindAccel * state.wind) * dt;
  state.inrunDistance += state.speed * dt;
  const point = inrunPointAt(hill, state.inrunDistance);
  state.x = point.x;
  state.y = point.y;
  if (state.inrunDistance >= hill.inrunLength) launch(state);
}

function updateAngle(state, controls, dt) {
  const C = JUMP_CONFIG;
  state.gustTimer -= dt;
  if (state.gustTimer <= 0) {
    state.gustTimer = C.gustInterval;
    state.gust = (state.rng() * 2 - 1) * C.gustPerWind * state.wind;
  }
  const control = (controls.up ? 1 : 0) - (controls.down ? 1 : 0);
  const rate = C.driftRate + state.gust + control * C.controlRate;
  state.angle = Math.min(C.maxAngle, Math.max(0, state.angle + rate * dt));
}

function fly(state, dt) {
  const C = JUMP_CONFIG;
  const speed = Math.hypot(state.vx, state.vy);
  const efficiency = angleEfficiency(state.angle);
  const lift = C.lift * speed * speed * (C.liftMin + (1 - C.liftMin) * efficiency);
  const drag = C.drag * speed * speed * (1 + C.offAngleDrag * (1 - efficiency));
  const ux = state.vx / speed;
  const uy = state.vy / speed;
  // Lift acts perpendicular to the flight path (direction rotated +90°), drag against it.
  state.vx += (-uy * lift - ux * drag) * dt;
  state.vy += (ux * lift - uy * drag - C.gravity) * dt;
  state.x += state.vx * dt;
  state.y += state.vy * dt;
  state.speed = Math.hypot(state.vx, state.vy);
}

function touchDown(state, previousX, previousY, dt) {
  const { hill } = state;
  const gapBefore = previousY - hillHeightAt(hill, previousX);
  const gapAfter = hillHeightAt(hill, state.x) - state.y;
  const fraction = gapBefore / Math.max(gapBefore + gapAfter, 1e-9);
  const touchX = previousX + (state.x - previousX) * fraction;
  const touchTime = state.time - dt * (1 - fraction);
  state.x = touchX;
  state.y = hillHeightAt(hill, touchX);
  state.distance = Math.min(SKI_JUMP_MAX_DISTANCE, Math.round(touchX * 10) / 10);
  const gap = state.lastLandingPress === null ? null : touchTime - state.lastLandingPress;
  state.landing = classifyLanding(gap, state.takeoff?.late === true);
  state.phase = state.landing === 'fall' ? 'fallen' : 'landed';
  state.speed = Math.max(0, state.vx);
  state.events.push({ type: 'touchdown', landing: state.landing });
}

function stepFlight(state, controls, dt) {
  if (controls.presses > 0) {
    if (!state.takeoff && state.time - state.lipTime <= JUMP_CONFIG.lateTakeoffWindow) {
      state.takeoff = { quality: 0, late: true };
      state.events.push({ type: 'lateTakeoff' });
    } else {
      state.lastLandingPress = state.time;
    }
  }
  updateAngle(state, controls, dt);
  const previousX = state.x;
  const previousY = state.y;
  fly(state, dt);
  if (state.x > 0.5 && state.y <= hillHeightAt(state.hill, state.x)) touchDown(state, previousX, previousY, dt);
}

function slide(state, dt) {
  const decel = state.phase === 'fallen' ? JUMP_CONFIG.fallenDecel : JUMP_CONFIG.landedDecel;
  state.speed = Math.max(0, state.speed - decel * dt);
  state.x = Math.min(state.hill.outrunEnd, state.x + state.speed * dt);
  state.y = hillHeightAt(state.hill, state.x);
}

export function stepJump(state, controls, dt) {
  state.events = [];
  if (state.phase === 'ready') {
    if (controls.presses > 0) {
      state.phase = 'inrun';
      state.events.push({ type: 'start' });
    }
    return state;
  }
  state.time += dt;
  if (state.phase === 'inrun') stepInrun(state, controls, dt);
  else if (state.phase === 'flight') stepFlight(state, controls, dt);
  else slide(state, dt);
  return state;
}
