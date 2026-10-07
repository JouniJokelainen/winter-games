import { createJumpState, isJumpActive, JUMP_CONFIG, stepJump } from '../../game/events/skiJump/skiJumpSim.js';
import { fakeInput } from './fakeInput.js';

const DEG = Math.PI / 180;

export const BOTS = {
  perfect: { takeoffAt: 0.03, targetAngle: 45, deadband: 1.5, landAt: 0.3 },
  average: { takeoffAt: 0.22, targetAngle: 48, deadband: 5, landAt: 0.3 },
  late: { takeoffAt: -0.2, targetAngle: 45, deadband: 1.5, landAt: 0.3 },
};

// Seconds until touchdown, predicted by simulating ahead with neutral controls and no gusts.
export function timeToTouchdown(state, dt = 1 / 60) {
  const ghost = { ...state, rng: () => 0.5, events: [] };
  for (let t = dt; t < 10; t += dt) {
    stepJump(ghost, { up: false, down: false, presses: 0 }, dt);
    if (ghost.phase !== 'flight') return t;
  }
  return Infinity;
}

export function botControls(state, profile) {
  let presses = 0;
  if (state.phase === 'ready') {
    presses = 1;
  } else if (state.phase === 'inrun' && !state.takeoff && profile.takeoffAt >= 0) {
    const timeToLip = (state.hill.inrunLength - state.inrunDistance) / Math.max(state.speed, 0.1);
    if (timeToLip <= profile.takeoffAt) presses = 1;
  } else if (state.phase === 'flight') {
    const sinceLip = state.time - state.lipTime;
    if (!state.takeoff && profile.takeoffAt < 0) {
      if (sinceLip >= -profile.takeoffAt) presses = 1;
    } else if ((state.takeoff || sinceLip > JUMP_CONFIG.lateTakeoffWindow)
      && state.lastLandingPress === null
      && timeToTouchdown(state) <= profile.landAt) {
      presses = 1;
    }
  }
  const target = profile.targetAngle * DEG;
  const deadband = profile.deadband * DEG;
  const flying = state.phase === 'flight';
  return {
    up: flying && state.angle < target - deadband,
    down: flying && state.angle > target + deadband,
    presses,
  };
}

export function botInput(state, profile) {
  const controls = botControls(state, profile);
  const held = [];
  if (controls.up) held.push('ArrowLeft');
  if (controls.down) held.push('ArrowRight');
  return fakeInput(controls.presses > 0 ? ['Space'] : [], [], { held });
}

export function runBot(hill, profile, options) {
  const state = createJumpState(hill, options);
  for (let tick = 0; tick < 60 * 30 && isJumpActive(state); tick++) {
    stepJump(state, botControls(state, profile), 1 / 60);
  }
  return state;
}
