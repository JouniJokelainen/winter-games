import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skiJumpPoints } from '../../../game/core/scoring.js';
import { createRng } from '../../../game/engine/rng.js';
import { EVENTS } from '../../../game/events/registry.js';
import { HILL } from '../../../game/events/skiJump/hill.js';
import { buildAttempt, drawWind, FINISH_HOLD_SECONDS, SkiJumpScene } from '../../../game/events/skiJump/skiJumpScene.js';
import { createJumpState } from '../../../game/events/skiJump/skiJumpSim.js';
import { validateResult } from '../../../server/leaderboard.js';
import { fakeInput } from '../../helpers/fakeInput.js';
import { BOTS, botInput } from '../../helpers/skiJumpBot.js';

const DT = 1 / 60;

function recordingGame() {
  const sounds = [];
  return { sounds, audio: { playSfx: (name) => sounds.push(name) } };
}

function playWithBot(scene, profile, maxTicks = 60 * 30) {
  for (let tick = 0; tick < maxTicks; tick++) scene.update(DT, botInput(scene.state, profile));
}

test('drawWind gives 0-4 m/s with one decimal', () => {
  const rng = createRng(5);
  for (let i = 0; i < 200; i++) {
    const wind = drawWind(rng);
    assert.ok(wind >= 0 && wind <= 4);
    assert.equal(wind, Math.round(wind * 10) / 10);
  }
  assert.equal(drawWind(() => 0.999999), 4);
});

test('buildAttempt scores a landed jump with skiJumpPoints', () => {
  const state = { ...createJumpState(HILL, { wind: 2.4 }), phase: 'landed', distance: 187.5, landing: 'perfect' };
  const attempt = buildAttempt(state);
  assert.equal(attempt.valid, true);
  assert.equal(attempt.points, skiJumpPoints(187.5, 'perfect'));
  assert.equal(attempt.distance, 187.5);
  assert.deepEqual(attempt.summary, ['PITUUS 187,5 M', 'ALASTULO TÄYDELLINEN', 'TUULI 2,4 M/S', `PISTEET ${attempt.points}`]);
});

test('buildAttempt marks a fall invalid but keeps a positive distance', () => {
  const fall = buildAttempt({ ...createJumpState(HILL), phase: 'fallen', distance: 150.2, landing: 'fall' });
  assert.equal(fall.valid, false);
  assert.equal(fall.points, 0);
  assert.equal(fall.distance, 150.2);
  assert.equal(fall.summary[1], 'ALASTULO KAATUMINEN');
  const instant = buildAttempt({ ...createJumpState(HILL), phase: 'fallen', distance: 0, landing: 'fall' });
  assert.ok(instant.distance > 0);
});

test('a perfect bot jump completes once after the hold with a valid attempt the server accepts', () => {
  const game = recordingGame();
  const attempts = [];
  const scene = new SkiJumpScene({ game, mode: 'competition', attemptNumber: 2, wind: 4, rng: createRng(1), onComplete: (a) => attempts.push(a) });
  assert.equal(scene.label, 'HYPPY 2/3');
  playWithBot(scene, BOTS.perfect);
  assert.equal(attempts.length, 1);
  const [attempt] = attempts;
  assert.equal(attempt.valid, true);
  assert.ok(attempt.distance >= 199 && attempt.distance <= 200);
  assert.equal(attempt.points, skiJumpPoints(attempt.distance, 'perfect'));
  for (const sound of ['jump', 'tick', 'land']) assert.ok(game.sounds.includes(sound), sound);
  const payload = {
    nickname: 'AKU',
    events: {
      skiJump: { points: attempt.points, distance: attempt.distance },
      slalom: { points: 0, time: null },
      luge: { points: 0, time: null },
    },
  };
  assert.equal(validateResult(payload).ok, true);
});

test('the scene waits for the finish hold before completing', () => {
  const attempts = [];
  const scene = new SkiJumpScene({ game: recordingGame(), mode: 'practice', attemptNumber: 1, wind: 0, onComplete: (a) => attempts.push(a) });
  Object.assign(scene.state, { phase: 'landed', distance: 120, landing: 'poor', x: 120, speed: 0 });
  const holdTicks = Math.round(FINISH_HOLD_SECONDS / DT);
  for (let i = 0; i < holdTicks - 2; i++) scene.update(DT, fakeInput([]));
  assert.equal(attempts.length, 0);
  for (let i = 0; i < 4; i++) scene.update(DT, fakeInput([]));
  assert.equal(attempts.length, 1);
});

test('a late takeoff falls with crash and fail sounds', () => {
  const game = recordingGame();
  const attempts = [];
  const scene = new SkiJumpScene({ game, mode: 'practice', attemptNumber: 3, wind: 1, onComplete: (a) => attempts.push(a) });
  assert.equal(scene.label, 'HARJOITUS 3');
  playWithBot(scene, BOTS.late);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].valid, false);
  assert.ok(game.sounds.includes('crash'));
  assert.ok(game.sounds.includes('fail'));
});

test('the registry creates the real ski jump scene', () => {
  const scene = EVENTS.skiJump.createScene({ game: recordingGame(), mode: 'practice', attemptNumber: 1, onComplete() {} });
  assert.ok(scene instanceof SkiJumpScene);
  assert.ok(scene.state.wind >= 0 && scene.state.wind <= 4);
});
