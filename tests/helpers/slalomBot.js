import { createSlalomState, SLALOM_CONFIG, stepSlalom } from '../../game/events/slalom/slalomSim.js';
import { fakeInput } from './fakeInput.js';

export const BOTS = {
  excellent: { margin: 9, pushEvery: 5, pushAngle: 0.5 },
  average: { margin: 12, pushEvery: 8, pushAngle: 0.5 },
  reckless: { margin: 8, pushEvery: 4, pushAngle: 1.1 },
};

const STEER_DEADBAND = 0.03;

export function botControls(state, profile, tick) {
  const pole = state.course.poles[state.nextPole];
  let desired = 0;
  if (pole) {
    const targetX = pole.x + (pole.side === 'left' ? -profile.margin : profile.margin);
    desired = Math.atan2(targetX - state.x, Math.max(pole.y - state.y, 1));
  }
  desired = Math.max(-SLALOM_CONFIG.maxAngle, Math.min(SLALOM_CONFIG.maxAngle, desired));
  const push = state.phase === 'ready'
    || (tick % profile.pushEvery === 0 && Math.abs(state.angle) < profile.pushAngle);
  return {
    left: state.angle > desired + STEER_DEADBAND,
    right: state.angle < desired - STEER_DEADBAND,
    pushes: push ? 1 : 0,
  };
}

export function runBot(course, profile, maxSeconds = 120) {
  const state = createSlalomState(course);
  for (let tick = 0; tick < maxSeconds * 60; tick++) {
    if (state.phase !== 'ready' && state.phase !== 'running') break;
    stepSlalom(state, botControls(state, profile, tick), 1 / 60);
  }
  return state;
}

export function botInput(state, profile, tick) {
  const controls = botControls(state, profile, tick);
  const held = [];
  if (controls.left) held.push('ArrowLeft');
  if (controls.right) held.push('ArrowRight');
  return fakeInput(controls.pushes > 0 ? ['Space'] : [], [], { held });
}
