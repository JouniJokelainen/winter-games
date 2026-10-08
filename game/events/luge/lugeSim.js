import { curvatureAt, FINISH_S, RED_LINE_S } from './lugeTrack.js';

// Distances in metres, speeds in m/s. Tuned with the bot test (tests/events/luge/bot.test.js).
export const LUGE_CONFIG = {
  pushImpulse: 0.3, // speed added per Space press while pushing
  pushDecay: 0.8, // speed lost per second while pushing
  pushMin: 1, // the runner never stops walking
  pushMax: 4,
  gravity: 9.3,
  drag: 0.0022,
  brake: 15,
  lateralRate: 2.6, // lateral units per second while an arrow is held
  straightReturn: 0.4, // lateral units per second back to the centre on a straight with no arrow held
  driftGain: 0.025, // outward slide in a turn: lateral units per second = driftGain · v² · |k|
  turnGain: 8, // speed change (m/s²) at kMax with the sled fully on the outer (+) or inner (-) side
  kMax: 0.045,
  safeA: 48, // vSafe(k) = sqrt(safeA / |k|) on the centre line
  outerSafe: 0.4, // the safe speed grows by this share on the outer side and shrinks on the inner side
  kSafeMin: 0.004, // gentler curves have no speed limit and no drift
  lookStep: 5,
  timeLimit: 45, // a run still going after this many seconds is rejected
};

// +1 = fully on the outer side of the turn, -1 = fully on the inner side. A right turn (k > 0) has its outer side on the left.
function outerSide(k, lateral) {
  return -lateral * Math.sign(k);
}

export function vSafeOuter(k, outer) {
  return Math.sqrt(LUGE_CONFIG.safeA / Math.abs(k)) * (1 + LUGE_CONFIG.outerSafe * outer);
}

export function vSafe(k, lateral = 0) {
  return vSafeOuter(k, outerSide(k, lateral));
}

// Lowest safe speed over the next `distance` metres of track, assuming the sled is at `outer` (-1..1) in every
// turn; Infinity when no turn is in range.
export function speedLimitAhead(s, distance, outer = 0) {
  let limit = Infinity;
  for (let d = 0; d <= distance; d += LUGE_CONFIG.lookStep) {
    const k = curvatureAt(s + d);
    if (Math.abs(k) > LUGE_CONFIG.kSafeMin) limit = Math.min(limit, vSafeOuter(k, outer));
  }
  return limit;
}

export function createLugeState() {
  return { phase: 'ready', s: 0, v: 0, lateral: 0, time: 0, reason: null, events: [] };
}

function stepPush(state, controls, dt) {
  const c = LUGE_CONFIG;
  state.time += dt;
  state.v = Math.min(c.pushMax, Math.max(c.pushMin, state.v + controls.pushes * c.pushImpulse - c.pushDecay * dt));
  state.s += state.v * dt;
  if (state.s >= RED_LINE_S) {
    state.phase = 'running';
    state.events.push({ type: 'hop' });
  }
}

function crash(state, reason) {
  state.phase = 'crashed';
  state.reason = reason;
  state.events.push({ type: 'crash' });
}

function steer(state, controls, k, dt) {
  const c = LUGE_CONFIG;
  const direction = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
  state.lateral += direction * c.lateralRate * dt;
  if (Math.abs(k) > c.kSafeMin) {
    state.lateral -= c.driftGain * state.v * state.v * k * dt;
  } else if (!direction) {
    state.lateral -= Math.sign(state.lateral) * Math.min(Math.abs(state.lateral), c.straightReturn * dt);
  }
}

function stepRun(state, controls, dt) {
  const c = LUGE_CONFIG;
  state.time += dt;
  const k = curvatureAt(state.s);
  steer(state, controls, k, dt);
  const outer = outerSide(k, state.lateral);
  const acceleration = c.gravity - c.drag * state.v * state.v - (controls.down ? c.brake : 0)
    + c.turnGain * (Math.abs(k) / c.kMax) * outer;
  state.v = Math.max(0, state.v + acceleration * dt);
  state.s += state.v * dt;

  if (Math.abs(state.lateral) >= 1) {
    state.lateral = Math.sign(state.lateral);
    crash(state, 'wall');
  } else if (Math.abs(k) > c.kSafeMin && state.v > vSafe(k, state.lateral)) {
    crash(state, 'speed');
  } else if (state.s >= FINISH_S) {
    state.time -= (state.s - FINISH_S) / state.v;
    state.s = FINISH_S;
    state.phase = 'finished';
    state.events.push({ type: 'finish' });
  } else if (state.time >= c.timeLimit) {
    crash(state, 'time');
  }
}

export function stepLuge(state, controls, dt) {
  state.events = [];
  if (state.phase === 'ready' && controls.pushes > 0) {
    state.phase = 'pushing';
    state.events.push({ type: 'start' });
  }
  if (state.phase === 'pushing') stepPush(state, controls, dt);
  else if (state.phase === 'running') stepRun(state, controls, dt);
}
