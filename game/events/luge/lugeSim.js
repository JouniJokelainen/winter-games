import { curvatureAt, FINISH_S, RED_LINE_S } from './lugeTrack.js';

// Distances in metres, speeds in m/s. Tuned with the bot test (tests/events/luge/bot.test.js).
export const LUGE_CONFIG = {
  pushImpulse: 0.3, // speed added per Space press while pushing
  pushDecay: 0.8, // speed lost per second while pushing
  pushMin: 1, // the runner never stops walking
  pushMax: 4,
  gravity: 8.3,
  drag: 0.0022,
  brake: 15,
  lateralRate: 1.6, // lateral units per second while an arrow is held
  lateralReturn: 0.8, // lateral units per second back to the centre
  turnGain: 5, // speed change (m/s²) at kMax with the sled fully on the outer (+) or inner (-) side
  kMax: 0.045,
  safeA: 68, // vSafe(k) = sqrt(safeA / |k|)
  kSafeMin: 0.004, // gentler curves have no speed limit
  lookStep: 5,
};

export function vSafe(k) {
  return Math.sqrt(LUGE_CONFIG.safeA / Math.abs(k));
}

// Lowest safe speed over the next `distance` metres of track; Infinity when no turn is in range.
export function speedLimitAhead(s, distance) {
  let limit = Infinity;
  for (let d = 0; d <= distance; d += LUGE_CONFIG.lookStep) {
    const k = curvatureAt(s + d);
    if (Math.abs(k) > LUGE_CONFIG.kSafeMin) limit = Math.min(limit, vSafe(k));
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

function stepRun(state, controls, dt) {
  const c = LUGE_CONFIG;
  state.time += dt;
  const direction = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
  if (direction) state.lateral += direction * c.lateralRate * dt;
  else state.lateral -= Math.sign(state.lateral) * Math.min(Math.abs(state.lateral), c.lateralReturn * dt);

  const k = curvatureAt(state.s);
  const outer = -state.lateral * Math.sign(k); // +: outer side of the turn, -: inner side
  const acceleration = c.gravity - c.drag * state.v * state.v - (controls.down ? c.brake : 0)
    + c.turnGain * (Math.abs(k) / c.kMax) * outer;
  state.v = Math.max(0, state.v + acceleration * dt);
  state.s += state.v * dt;

  if (Math.abs(state.lateral) >= 1) {
    state.lateral = Math.sign(state.lateral);
    crash(state, 'wall');
  } else if (Math.abs(k) > c.kSafeMin && state.v > vSafe(k)) {
    crash(state, 'speed');
  } else if (state.s >= FINISH_S) {
    state.time -= (state.s - FINISH_S) / state.v;
    state.s = FINISH_S;
    state.phase = 'finished';
    state.events.push({ type: 'finish' });
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
