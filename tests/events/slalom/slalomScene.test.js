import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slalomPoints } from '../../../game/core/scoring.js';
import { EVENTS } from '../../../game/events/registry.js';
import { createSlalomState } from '../../../game/events/slalom/slalomSim.js';
import { COURSE } from '../../../game/events/slalom/course.js';
import { buildAttempt, FINISH_HOLD_SECONDS, SlalomScene } from '../../../game/events/slalom/slalomScene.js';
import { fakeInput } from '../../helpers/fakeInput.js';
import { BOTS, botInput } from '../../helpers/slalomBot.js';

const DT = 1 / 60;

function recordingGame() {
  const sounds = [];
  return { sounds, audio: { playSfx: (name) => sounds.push(name), setLoop() {} } };
}

function play(scene, inputFor, maxTicks = 60 * 120) {
  for (let tick = 0; tick < maxTicks; tick++) scene.update(DT, inputFor(scene.state, tick));
}

test('buildAttempt scores a finished run with slalomPoints', () => {
  const state = { ...createSlalomState(COURSE), phase: 'finished', time: 31.234, hits: 1, missed: 1 };
  const attempt = buildAttempt(state);
  assert.equal(attempt.valid, true);
  assert.equal(attempt.time, 31.23);
  assert.equal(attempt.points, slalomPoints({ time: 31.23, hits: 1, missed: 1 }));
  assert.deepEqual(attempt.summary, ['AIKA 31,23 S', 'OSUMAT 1', 'OHITETUT KEPIT 1', `PISTEET ${attempt.points}`]);
});

test('buildAttempt marks a disqualified run invalid with the reason', () => {
  const out = buildAttempt({ ...createSlalomState(COURSE), phase: 'disqualified', reason: 'outOfBounds', time: 4.5 });
  assert.equal(out.valid, false);
  assert.equal(out.points, 0);
  assert.ok(out.time > 0);
  assert.deepEqual(out.summary.slice(-2), ['HYLÄTTY', 'ULOS RADALTA']);
  const missed = buildAttempt({ ...createSlalomState(COURSE), phase: 'disqualified', reason: 'missedPoles', time: 0 });
  assert.ok(missed.time > 0);
  assert.equal(missed.summary.at(-1), '2 OHITETTUA KEPPIÄ');
});

test('buildAttempt omits the reason line for an unknown disqualification reason', () => {
  const out = buildAttempt({ ...createSlalomState(COURSE), phase: 'disqualified', reason: 'mystery', time: 4.5 });
  assert.equal(out.valid, false);
  assert.deepEqual(out.summary.slice(-1), ['HYLÄTTY']);
  assert.ok(out.summary.every((line) => !line.includes('undefined')));
});

test('no push sound when the pushing step disqualifies the run', () => {
  const game = recordingGame();
  const scene = new SlalomScene({ game, mode: 'practice', attemptNumber: 1, onComplete() {} });
  Object.assign(scene.state, { phase: 'running', speed: 100, x: COURSE.fenceLeftX + 0.1 });
  scene.state.angle = -0.5;
  scene.update(DT, fakeInput(['Space'], [], { held: ['ArrowLeft'] }));
  assert.equal(scene.state.phase, 'disqualified');
  assert.ok(!game.sounds.includes('push'));
});

test('an excellent bot run completes once, after the finish hold, with a valid attempt', () => {
  const game = recordingGame();
  const attempts = [];
  const scene = new SlalomScene({ game, mode: 'competition', attemptNumber: 2, onComplete: (a) => attempts.push(a) });
  assert.equal(scene.label, 'YRITYS 2/3');
  let finishedAtTick = null;
  for (let tick = 0; tick < 60 * 60 && attempts.length === 0; tick++) {
    scene.update(DT, botInput(scene.state, BOTS.excellent, tick));
    if (finishedAtTick === null && scene.state.phase === 'finished') finishedAtTick = tick;
  }
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].valid, true);
  assert.ok(attempts[0].points >= 55);
  assert.ok(attempts[0].time >= 28 && attempts[0].time <= 31);
  play(scene, () => fakeInput(['Space']), 120);
  assert.equal(attempts.length, 1);
  assert.ok(game.sounds.includes('push'));
  assert.ok(game.sounds.includes('finish'));
  assert.ok(finishedAtTick !== null);
});

test('the scene waits for the finish hold before completing', () => {
  const attempts = [];
  const scene = new SlalomScene({ game: recordingGame(), mode: 'practice', attemptNumber: 1, onComplete: (a) => attempts.push(a) });
  scene.state.phase = 'finished';
  const holdTicks = Math.round(FINISH_HOLD_SECONDS / DT);
  for (let i = 0; i < holdTicks - 2; i++) scene.update(DT, fakeInput([]));
  assert.equal(attempts.length, 0);
  for (let i = 0; i < 4; i++) scene.update(DT, fakeInput([]));
  assert.equal(attempts.length, 1);
});

test('a straight run is disqualified with crash and fail sounds', () => {
  const game = recordingGame();
  const attempts = [];
  const scene = new SlalomScene({ game, mode: 'practice', attemptNumber: 3, onComplete: (a) => attempts.push(a) });
  assert.equal(scene.label, 'HARJOITUS 3');
  play(scene, (state, tick) => fakeInput(tick % 10 === 0 ? ['Space'] : []), 60 * 30);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].valid, false);
  assert.deepEqual(attempts[0].summary.slice(-2), ['HYLÄTTY', '2 OHITETTUA KEPPIÄ']);
  assert.ok(game.sounds.includes('crash'));
  assert.ok(game.sounds.includes('fail'));
});

test('fast tapping within one tick adds several pushes', () => {
  const one = new SlalomScene({ game: recordingGame(), mode: 'practice', attemptNumber: 1, onComplete() {} });
  const three = new SlalomScene({ game: recordingGame(), mode: 'practice', attemptNumber: 1, onComplete() {} });
  for (const scene of [one, three]) scene.update(DT, fakeInput(['Space']));
  one.update(DT, fakeInput(['Space']));
  three.update(DT, fakeInput(['Space', 'Space', 'Space']));
  assert.ok(three.state.speed > one.state.speed + 20);
});

test('the registry creates the real slalom scene', () => {
  const scene = EVENTS.slalom.createScene({ game: recordingGame(), mode: 'practice', attemptNumber: 1, onComplete() {} });
  assert.ok(scene instanceof SlalomScene);
  assert.deepEqual(EVENTS.slalom.instructions, ['VÄLILYÖNTI = LÄHTÖ JA VAUHTI', 'NUOLET = KÄÄNTYMINEN', 'KIERRÄ KEPIT ULKOPUOLELTA']);
});

test('the slalom scene draws at the full canvas resolution', () => {
  const scene = new SlalomScene({ game: recordingGame(), mode: 'practice', attemptNumber: 1, onComplete() {} });
  assert.equal(scene.highResolution, true);
});
