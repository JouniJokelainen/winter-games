import { formatTime } from '../../core/format.js';
import { ATTEMPTS_PER_EVENT } from '../../core/rules.js';
import { slalomPoints } from '../../core/scoring.js';
import { COURSE } from './course.js';
import { renderSlalom } from './slalomRender.js';
import { createSlalomState, stepSlalom } from './slalomSim.js';

export const FINISH_HOLD_SECONDS = 1;

const MIN_ATTEMPT_TIME = 0.01;
const FENCE_WARNING_DISTANCE = 12;
const FENCE_WARNING_INTERVAL = 0.5;
const TRACK_SPACING = 2;
const TRACK_LIMIT = 600;

const DISQUALIFICATION_LABEL = {
  outOfBounds: 'ULOS RADALTA',
  missedPoles: '2 OHITETTUA KEPPIÄ',
};

const EVENT_SOUNDS = {
  start: ['push'],
  hit: ['hit'],
  finish: ['finish'],
  disqualified: ['crash', 'fail'],
};

export function buildAttempt(state) {
  const time = Math.max(MIN_ATTEMPT_TIME, Math.round(state.time * 100) / 100);
  const lines = [`AIKA ${formatTime(time)}`, `OSUMAT ${state.hits}`, `OHITETUT KEPIT ${state.missed}`];
  if (state.phase === 'finished') {
    const points = slalomPoints({ time, hits: state.hits, missed: state.missed });
    return { valid: true, points, time, summary: [...lines, `PISTEET ${points}`] };
  }
  const reason = DISQUALIFICATION_LABEL[state.reason];
  return { valid: false, points: 0, time, summary: [...lines, 'HYLÄTTY', ...(reason ? [reason] : [])] };
}

export class SlalomScene {
  constructor({ game, mode, attemptNumber, onComplete, course = COURSE }) {
    this.game = game;
    this.highResolution = true;
    this.onComplete = onComplete;
    this.state = createSlalomState(course);
    this.label = mode === 'competition' ? `YRITYS ${attemptNumber}/${ATTEMPTS_PER_EVENT}` : `HARJOITUS ${attemptNumber}`;
    this.track = [];
    this.time = 0;
    this.holdTime = 0;
    this.sinceWarning = FENCE_WARNING_INTERVAL;
    this.done = false;
  }

  update(dt, input) {
    this.time += dt;
    if (this.done) return;
    const { state } = this;
    if (state.phase === 'ready' || state.phase === 'running') {
      const wasRunning = state.phase === 'running';
      const controls = {
        left: input.isDown('ArrowLeft'),
        right: input.isDown('ArrowRight'),
        pushes: input.pressCount('Space'),
      };
      stepSlalom(state, controls, dt);
      if (wasRunning && controls.pushes > 0 && state.phase === 'running') this.game.audio.playSfx('push');
      for (const event of state.events) {
        for (const sound of EVENT_SOUNDS[event.type] ?? []) this.game.audio.playSfx(sound);
      }
      this.recordTrack();
      this.warnNearFence(dt);
      return;
    }
    this.holdTime += dt;
    if (this.holdTime >= FINISH_HOLD_SECONDS - 1e-9) {
      this.done = true;
      this.onComplete(buildAttempt(state));
    }
  }

  recordTrack() {
    const { state } = this;
    if (state.phase !== 'running') return;
    const last = this.track.at(-1);
    if (!last || state.y - last.y >= TRACK_SPACING) {
      this.track.push({ x: state.x, y: state.y });
      if (this.track.length > TRACK_LIMIT) this.track.shift();
    }
  }

  warnNearFence(dt) {
    const { state } = this;
    this.sinceWarning += dt;
    if (state.phase !== 'running') return;
    const distance = Math.min(state.x - state.course.fenceLeftX, state.course.fenceRightX - state.x);
    if (distance < FENCE_WARNING_DISTANCE && this.sinceWarning >= FENCE_WARNING_INTERVAL) {
      this.game.audio.playSfx('warning');
      this.sinceWarning = 0;
    }
  }

  render(ctx) {
    renderSlalom(ctx, { state: this.state, track: this.track, label: this.label, time: this.time });
  }
}
