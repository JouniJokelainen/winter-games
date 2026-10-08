import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINISH_HOLD_SECONDS, LugeScene, buildAttempt } from '../../../game/events/luge/lugeScene.js';
import { createLugeState } from '../../../game/events/luge/lugeSim.js';
import { fakeInput } from '../../helpers/fakeInput.js';
import { BOTS, botInput } from '../../helpers/lugeBot.js';
import { PALETTE } from '../../../game/engine/palette.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

function makeScene(options = {}) {
  const sounds = [];
  const completed = [];
  const scene = new LugeScene({
    game: { audio: { playSfx: (name) => sounds.push(name) } },
    mode: 'competition',
    attemptNumber: 2,
    onComplete: (attempt) => completed.push(attempt),
    ...options,
  });
  return { scene, sounds, completed };
}

function drive(scene, bot, seconds = 120) {
  for (let tick = 0; tick < seconds * 60 && !scene.done; tick++) scene.update(1 / 60, botInput(scene.state, bot, tick));
}

test('a good run completes once, after the finish hold, with a valid attempt', () => {
  const { scene, sounds, completed } = makeScene();
  drive(scene, BOTS.good);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].valid, true);
  assert.ok(completed[0].points >= 55 && completed[0].points <= 60);
  assert.equal(completed[0].summary[0].startsWith('AIKA '), true);
  assert.ok(sounds.includes('push') && sounds.includes('finish'));
  scene.update(1 / 60, fakeInput([]));
  assert.equal(completed.length, 1);
});

test('nothing completes before the hold time has passed', () => {
  const { scene, completed } = makeScene();
  const state = Object.assign(scene.state, { phase: 'finished', time: 29.5 });
  scene.update(FINISH_HOLD_SECONDS / 2, fakeInput([]));
  assert.equal(completed.length, 0);
  scene.update(FINISH_HOLD_SECONDS / 2 + 0.01, fakeInput([]));
  assert.equal(completed.length, 1);
  assert.equal(state.phase, 'finished');
});

test('a crash gives a rejected attempt and plays the crash sounds', () => {
  const { scene, sounds, completed } = makeScene();
  for (let tick = 0; tick < 60 * 120 && !scene.done; tick++) {
    scene.update(1 / 60, fakeInput(tick % 7 === 0 ? ['Space'] : []));
  }
  assert.equal(completed.length, 1);
  assert.equal(completed[0].valid, false);
  assert.equal(completed[0].points, 0);
  assert.ok(completed[0].summary.includes('HYLÄTTY'));
  assert.ok(completed[0].summary.includes('SUISTUIT RADALTA'));
  assert.ok(sounds.includes('crash') && sounds.includes('fail'));
});

test('buildAttempt scores finished runs and labels the crash reasons', () => {
  const finished = { ...createLugeState(), phase: 'finished', time: 32.4 };
  assert.deepEqual(buildAttempt(finished), { valid: true, points: 45, time: 32.4, summary: ['AIKA 32,40 S', 'PISTEET 45'] });
  const wall = { ...createLugeState(), phase: 'crashed', reason: 'wall', time: 12 };
  assert.deepEqual(buildAttempt(wall), { valid: false, points: 0, time: 12, summary: ['AIKA 12,00 S', 'HYLÄTTY', 'SUISTUIT RADALTA'] });
  const slow = { ...createLugeState(), phase: 'crashed', reason: 'time', time: 45 };
  assert.deepEqual(buildAttempt(slow), { valid: false, points: 0, time: 45, summary: ['AIKA 45,00 S', 'HYLÄTTY', 'AIKA YLITTYI'] });
});

function rectCountAtClock(scene, clock) {
  scene.time = clock;
  const ctx = recordingCtx();
  scene.render(ctx);
  return ctx.rects.length;
}

test('the crashed banner blinks on the scene clock even though the sim time is frozen', () => {
  const { scene } = makeScene();
  Object.assign(scene.state, { phase: 'crashed', reason: 'wall', s: 662, lateral: 1, time: 20.97 });
  const on = rectCountAtClock(scene, 0);
  const off = rectCountAtClock(scene, 0.5);
  assert.ok(on > off, `banner rects: on ${on}, off ${off}`);
});

test('the ready banner blinks on the scene clock', () => {
  const { scene } = makeScene();
  const on = rectCountAtClock(scene, 0);
  const off = rectCountAtClock(scene, 0.5);
  assert.ok(on > off, `banner rects: on ${on}, off ${off}`);
});

function runWithLateral(lateral, v) {
  const { scene, sounds } = makeScene();
  Object.assign(scene.state, { phase: 'running', s: 300, v, lateral });
  scene.update(1 / 60, fakeInput([]));
  return sounds;
}

test('the warning beep depends on rim proximity only', () => {
  assert.equal(runWithLateral(0, 60).includes('warning'), false);
  assert.equal(runWithLateral(0.9, 20).includes('warning'), true);
});

test('the label shows the attempt, and rendering works in every phase', () => {
  const { scene } = makeScene();
  assert.equal(scene.label, 'YRITYS 2/3');
  assert.equal(makeScene({ mode: 'practice' }).scene.label, 'HARJOITUS 2');
  assert.equal(scene.highResolution, true);
  const phases = [{ phase: 'ready' }, { phase: 'pushing', s: 5, v: 3 }, { phase: 'running', s: 662, v: 36, lateral: -0.9 },
    { phase: 'crashed', reason: 'wall', s: 662, lateral: 1 }, { phase: 'finished', s: 1060, v: 40 }];
  for (const patch of phases) {
    Object.assign(scene.state, patch);
    const ctx = recordingCtx();
    scene.render(ctx);
    assert.ok(ctx.rects.length > 2000, `${patch.phase}: ${ctx.rects.length} rects`);
  }
});

test('the speed limit shown follows the lateral position of the sled', () => {
  const { scene } = makeScene();
  Object.assign(scene.state, { phase: 'running', s: 60, v: 30 }); // the first turn (a right turn) is ahead
  scene.state.lateral = -0.8; // outer side of that turn
  const outer = scene.limit();
  scene.state.lateral = 0.8; // inner side
  const inner = scene.limit();
  assert.ok(outer > inner, `${outer} ${inner}`);
});

test('a crashed sled slides over the rim during the hold', () => {
  const { scene } = makeScene();
  Object.assign(scene.state, { phase: 'crashed', reason: 'wall', s: 662, lateral: 1 });
  assert.equal(scene.displayLateral(), 1);
  scene.holdTime = 0.5;
  assert.ok(scene.displayLateral() > 1.2);
  scene.state.lateral = -1;
  assert.ok(scene.displayLateral() < -1.2);
  scene.state.phase = 'running';
  assert.equal(scene.displayLateral(), -1);
});

test('the racing line is shown in practice and hidden in a competition', () => {
  const lineRects = (mode) => {
    const { scene } = makeScene({ mode });
    Object.assign(scene.state, { phase: 'running', s: 120, v: 30 });
    const ctx = recordingCtx();
    scene.render(ctx);
    return ctx.rects.filter((r) => r.color === PALETTE.orange).length;
  };
  assert.ok(lineRects('practice') > lineRects('competition') + 20);
});
