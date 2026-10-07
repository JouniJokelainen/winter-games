import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../game/engine/constants.js';
import { PALETTE } from '../../game/engine/palette.js';
import { InfoScene } from '../../game/scenes/infoScene.js';
import { PauseScene } from '../../game/scenes/pauseScene.js';
import { PracticeSelectScene } from '../../game/scenes/practiceSelectScene.js';
import { TitleScene } from '../../game/scenes/titleScene.js';
import { FinalScene } from '../../game/scenes/finalScene.js';
import { NicknameScene } from '../../game/scenes/nicknameScene.js';
import { fakeInput } from '../helpers/fakeInput.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

const OLD_COLORS = [PALETTE.yellow, PALETTE.skyLight, PALETTE.night];

function fakeGame() {
  return {
    audio: { muted: false, playSfx() {}, playSong() {}, toggleMuted() {} },
    repository: { getNicknames: () => new Promise(() => {}), saveResult: () => new Promise(() => {}) },
  };
}

function assertMenuStyle(scene, name) {
  assert.equal(scene.highResolution, true, `${name} highResolution`);
  const ctx = recordingCtx();
  scene.render(ctx);
  assert.ok(ctx.rects.length > 100, `${name} draws`);
  for (const r of ctx.rects) {
    assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${name} ${JSON.stringify(r)}`);
  }
  const used = new Set(ctx.rects.map((r) => r.color));
  for (const color of OLD_COLORS) assert.ok(!used.has(color), `${name} still uses ${color}`);
  assert.ok(used.has(PALETTE.paper) || used.has(PALETTE.red), `${name} uses the new text colours`);
  return ctx;
}

const fullCanvasBackdrop = (ctx) => ctx.rects[0].x === 0 && ctx.rects[0].y === 0 && ctx.rects[0].w === CANVAS_WIDTH;

test('the title scene uses the venue backdrop and the new look', () => {
  const scene = new TitleScene({ game: fakeGame(), onCompetition() {}, onPractice() {} });
  scene.update(1 / 60, fakeInput([]));
  assert.ok(fullCanvasBackdrop(assertMenuStyle(scene, 'title')));
});

test('the practice select scene uses the venue backdrop and the new look', () => {
  const scene = new PracticeSelectScene({ game: fakeGame(), onSelect() {}, onBack() {} });
  scene.update(1 / 60, fakeInput([]));
  assert.ok(fullCanvasBackdrop(assertMenuStyle(scene, 'practice select')));
});

test('the info scene uses the venue backdrop and the new look', () => {
  const scene = new InfoScene({ game: fakeGame(), title: 'MÄKIHYPPY', lines: ['HARJOITTELU', '', 'ESC = LOPETA'], onContinue() {} });
  scene.update(1 / 60, fakeInput([]));
  assert.ok(fullCanvasBackdrop(assertMenuStyle(scene, 'info')));
});

test('the pause scene dims the whole canvas and draws its panel in canvas pixels', () => {
  const scene = new PauseScene({ game: fakeGame(), onResume() {}, onQuit() {} });
  const ctx = assertMenuStyle(scene, 'pause');
  assert.deepEqual(ctx.rects[0], { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT, color: 'rgba(0, 0, 0, 0.6)' });
});

test('the nickname scene uses the new look in every state', () => {
  const scene = new NicknameScene({ game: fakeGame(), onConfirm() {}, onBack() {} });
  scene.update(1 / 60, fakeInput([]));
  assertMenuStyle(scene, 'nickname loading');
  scene.showList(['MATTI', 'LIISA']);
  assertMenuStyle(scene, 'nickname list');
  scene.state = 'entry';
  scene.entry.append('A');
  scene.message = 'NIMI ON VARATTU';
  const ctx = assertMenuStyle(scene, 'nickname entry');
  assert.ok(ctx.rects.some((r) => r.color === PALETTE.red), 'error message in red');
});

test('the final scene uses the new look', () => {
  const competition = {
    nickname: 'MATTI',
    eventIds: ['skiJump', 'slalom', 'luge'],
    eventResult: () => ({ points: 42 }),
    total: 126,
    toPayload: () => ({}),
  };
  const scene = new FinalScene({ game: fakeGame(), competition, onDone() {} });
  scene.update(1 / 60, fakeInput([]));
  assertMenuStyle(scene, 'final saving');
  scene.status = 'failed';
  const ctx = assertMenuStyle(scene, 'final failed');
  assert.ok(ctx.rects.some((r) => r.color === PALETTE.slateEdge && r.h === 2 && r.w === 440), 'divider');
});
