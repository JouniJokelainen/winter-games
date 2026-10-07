import { formatDistance, LANDING_LABEL } from '../../core/format.js';
import { ATTEMPTS_PER_EVENT } from '../../core/rules.js';
import { skiJumpPoints } from '../../core/scoring.js';
import { HILL } from './hill.js';
import { formatWind, renderSkiJump } from './skiJumpRender.js';
import { createJumpState, isJumpActive, JUMP_CONFIG, stepJump } from './skiJumpSim.js';

export const FINISH_HOLD_SECONDS = 1;

const MIN_DISTANCE = 0.1;

export function drawWind(rng) {
  return Math.round(rng() * JUMP_CONFIG.maxWind * 10) / 10;
}

export function buildAttempt(state) {
  const distance = Math.max(MIN_DISTANCE, state.distance ?? MIN_DISTANCE);
  const { landing } = state;
  const lines = [`PITUUS ${formatDistance(distance)}`, `ALASTULO ${LANDING_LABEL[landing]}`, `TUULI ${formatWind(state.wind)}`];
  if (landing === 'fall') return { valid: false, points: 0, distance, landing, summary: [...lines, 'PISTEET 0'] };
  const points = skiJumpPoints(distance, landing);
  return { valid: true, points, distance, landing, summary: [...lines, `PISTEET ${points}`] };
}

function soundsFor(event) {
  if (event.type === 'takeoff') return event.quality === 1 ? ['jump', 'tick'] : ['jump'];
  if (event.type === 'lateTakeoff') return ['jump'];
  if (event.type === 'touchdown') return event.landing === 'fall' ? ['crash', 'fail'] : ['land'];
  return [];
}

export class SkiJumpScene {
  constructor({ game, mode, attemptNumber, onComplete, hill = HILL, rng = Math.random, wind = drawWind(rng) }) {
    this.game = game;
    this.onComplete = onComplete;
    this.state = createJumpState(hill, { wind, rng });
    this.label = mode === 'competition' ? `HYPPY ${attemptNumber}/${ATTEMPTS_PER_EVENT}` : `HARJOITUS ${attemptNumber}`;
    this.time = 0;
    this.holdTime = 0;
    this.done = false;
    this.highResolution = true;
  }

  update(dt, input) {
    this.time += dt;
    if (this.done) return;
    const { state } = this;
    const wasActive = isJumpActive(state);
    stepJump(state, {
      up: input.isDown('ArrowLeft'),
      down: input.isDown('ArrowRight'),
      presses: input.pressCount('Space'),
    }, dt);
    for (const event of state.events) {
      for (const sound of soundsFor(event)) this.game.audio.playSfx(sound);
    }
    if (wasActive || isJumpActive(state)) return;
    this.holdTime += dt;
    if (this.holdTime >= FINISH_HOLD_SECONDS - 1e-9) {
      this.done = true;
      this.onComplete(buildAttempt(state));
    }
  }

  render(ctx) {
    renderSkiJump(ctx, { state: this.state, label: this.label, time: this.time });
  }
}
