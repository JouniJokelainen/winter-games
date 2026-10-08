import { formatTime } from '../../core/format.js';
import { ATTEMPTS_PER_EVENT } from '../../core/rules.js';
import { lugePoints } from '../../core/scoring.js';
import { SLED_Z } from './lugeProjection.js';
import { renderLuge } from './lugeRender.js';
import { createLugeState, speedLimitAhead, stepLuge } from './lugeSim.js';
import { turnNumber } from './lugeTrack.js';

export const FINISH_HOLD_SECONDS = 1;

const MIN_ATTEMPT_TIME = 0.01;
const LIMIT_LOOK_AHEAD = 120;
const WARNING_LATERAL = 0.85;
const WARNING_SPEED_SHARE = 0.92;
const WARNING_INTERVAL = 0.5;
const MS_TO_KMH = 3.6;
const STRIDE_LENGTH = 1.4; // metres of pushing per leg cycle

const CRASH_LABEL = {
  wall: 'OSUIT LAITAAN',
  speed: 'LIIAN KOVA VAUHTI',
};

const EVENT_SOUNDS = {
  finish: ['finish'],
  crash: ['crash', 'fail'],
};

const BANNERS = {
  ready: 'VÄLILYÖNTI = LÄHTÖ',
  pushing: 'NAPUTA VÄLILYÖNTIÄ!',
  finished: 'MAALI!',
  crashed: 'HYLÄTTY',
};

export function buildAttempt(state) {
  const time = Math.max(MIN_ATTEMPT_TIME, Math.round(state.time * 100) / 100);
  const timeLine = `AIKA ${formatTime(time)}`;
  if (state.phase === 'finished') {
    const points = lugePoints(time);
    return { valid: true, points, time, summary: [timeLine, `PISTEET ${points}`] };
  }
  const reason = CRASH_LABEL[state.reason];
  return { valid: false, points: 0, time, summary: [timeLine, 'HYLÄTTY', ...(reason ? [reason] : [])] };
}

export class LugeScene {
  constructor({ game, mode, attemptNumber, onComplete }) {
    this.game = game;
    this.highResolution = true;
    this.onComplete = onComplete;
    this.state = createLugeState();
    this.label = mode === 'competition' ? `YRITYS ${attemptNumber}/${ATTEMPTS_PER_EVENT}` : `HARJOITUS ${attemptNumber}`;
    this.time = 0;
    this.holdTime = 0;
    this.sinceWarning = WARNING_INTERVAL;
    this.done = false;
  }

  update(dt, input) {
    this.time += dt;
    if (this.done) return;
    const { state } = this;
    if (state.phase === 'ready' || state.phase === 'pushing' || state.phase === 'running') {
      const controls = {
        left: input.isDown('ArrowLeft'),
        right: input.isDown('ArrowRight'),
        down: input.isDown('ArrowDown'),
        pushes: input.pressCount('Space'),
      };
      stepLuge(state, controls, dt);
      if (controls.pushes > 0 && state.phase === 'pushing') this.game.audio.playSfx('push');
      for (const event of state.events) {
        for (const sound of EVENT_SOUNDS[event.type] ?? []) this.game.audio.playSfx(sound);
      }
      this.warn(dt);
      return;
    }
    this.holdTime += dt;
    if (this.holdTime >= FINISH_HOLD_SECONDS - 1e-9) {
      this.done = true;
      this.onComplete(buildAttempt(state));
    }
  }

  limit() {
    return this.state.phase === 'running' ? speedLimitAhead(this.state.s, LIMIT_LOOK_AHEAD) : Infinity;
  }

  isWarning() {
    const { state } = this;
    if (state.phase !== 'running') return false;
    return Math.abs(state.lateral) >= WARNING_LATERAL || state.v >= this.limit() * WARNING_SPEED_SHARE;
  }

  nearRim() {
    const { state } = this;
    return state.phase === 'running' && Math.abs(state.lateral) >= WARNING_LATERAL;
  }

  warn(dt) {
    this.sinceWarning += dt;
    if (this.nearRim() && this.sinceWarning >= WARNING_INTERVAL) {
      this.game.audio.playSfx('warning');
      this.sinceWarning = 0;
    }
  }

  render(ctx) {
    const { state } = this;
    const limit = this.limit();
    const pushing = state.phase === 'ready' || state.phase === 'pushing';
    renderLuge(ctx, {
      s: state.s - SLED_Z,
      time: state.time,
      clock: this.time,
      speedKmh: state.v * MS_TO_KMH,
      lateral: Math.max(-1, Math.min(1, state.lateral)),
      phase: pushing ? 'push' : state.phase === 'finished' ? 'finished' : 'ride',
      turn: turnNumber(state.s),
      label: this.label,
      limitKmh: Number.isFinite(limit) ? Math.round(limit * MS_TO_KMH) : null,
      warning: this.isWarning(),
      sparks: state.phase === 'crashed',
      banner: BANNERS[state.phase],
      stride: (state.s / STRIDE_LENGTH) % 1,
      showRedLine: pushing,
    });
  }
}
