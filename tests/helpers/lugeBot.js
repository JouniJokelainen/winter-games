import { createLugeState, speedLimitAhead, stepLuge } from '../../game/events/luge/lugeSim.js';
import { curvatureAt } from '../../game/events/luge/lugeTrack.js';
import { fakeInput } from './fakeInput.js';

// pushEvery: ticks between taps; look: metres of track watched for the speed limit; margin: share of the limit the
// bot is willing to carry into a turn; outer: how far toward the outer side it steers in a turn (0 = centre); it also assumes that
// position when it computes the speed limit; dead: how far from the target position the bot lets the sled wander before steering back.
export const BOTS = {
  good: { pushEvery: 7, look: 120, margin: 0.97, outer: 0.35, dead: 0.04 },
  centre: { pushEvery: 7, look: 120, margin: 0.97, outer: 0, dead: 0.04 },
  average: { pushEvery: 9, look: 60, margin: 0.8, outer: 0.2, dead: 0.04 },
  careless: { pushEvery: 8, look: 50, margin: 0.9, outer: 0.1, dead: 0.12 },
  fast: { pushEvery: 5, look: 120, margin: 0.97, outer: 0.35, dead: 0.04 },
  lazy: { pushEvery: 15, look: 120, margin: 0.97, outer: 0.35, dead: 0.04 },
};

const TURN_CURVATURE = 0.004;

export function botControls(state, profile, tick) {
  if (state.phase === 'ready' || state.phase === 'pushing') {
    return { left: false, right: false, down: false, pushes: tick % profile.pushEvery === 0 ? 1 : 0 };
  }
  const k = curvatureAt(state.s);
  const target = Math.abs(k) > TURN_CURVATURE ? -Math.sign(k) * profile.outer : 0;
  return {
    left: state.lateral > target + profile.dead,
    right: state.lateral < target - profile.dead,
    down: state.v > speedLimitAhead(state.s, profile.look, profile.outer) * profile.margin,
    pushes: 0,
  };
}

export function runBot(profile, maxSeconds = 120) {
  const state = createLugeState();
  for (let tick = 0; tick < maxSeconds * 60; tick++) {
    if (state.phase === 'crashed' || state.phase === 'finished') break;
    stepLuge(state, botControls(state, profile, tick), 1 / 60);
  }
  return state;
}

export function botInput(state, profile, tick) {
  const controls = botControls(state, profile, tick);
  const held = [];
  if (controls.left) held.push('ArrowLeft');
  if (controls.right) held.push('ArrowRight');
  if (controls.down) held.push('ArrowDown');
  return fakeInput(controls.pushes > 0 ? ['Space'] : [], [], { held });
}
