import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawText } from '../../game/engine/font.js';
import { PALETTE } from '../../game/engine/palette.js';
import { FinalScene } from '../../game/scenes/finalScene.js';
import { NicknameScene } from '../../game/scenes/nicknameScene.js';
import { fakeInput } from '../helpers/fakeInput.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function sceneWith(repository) {
  const confirmed = [];
  let backs = 0;
  const game = { audio: { playSfx() {} }, repository: { getNicknames: async () => ['AKU'], ...repository } };
  const scene = new NicknameScene({ game, onConfirm: (nickname) => confirmed.push(nickname), onBack: () => { backs++; } });
  return { scene, confirmed, backs: () => backs };
}

async function openList(scene) {
  scene.enter();
  await tick();
  assert.equal(scene.state, 'list');
}

test('a free or own nickname goes straight on', async () => {
  for (const status of ['free', 'mine']) {
    const { scene, confirmed } = sceneWith({ checkNickname: async () => status });
    await openList(scene);
    scene.update(1 / 60, fakeInput(['Space']));
    await tick();
    assert.deepEqual(confirmed, ['AKU'], status);
  }
});

test('without ownership checks (local and Node boards) the nickname is confirmed at once', async () => {
  const { scene, confirmed } = sceneWith({});
  await openList(scene);
  scene.update(1 / 60, fakeInput(['Space']));
  assert.deepEqual(confirmed, ['AKU']);
});

test('an unreachable board does not block the competition', async () => {
  const { scene, confirmed } = sceneWith({ checkNickname: async () => { throw new Error('offline'); } });
  await openList(scene);
  scene.update(1 / 60, fakeInput(['Space']));
  await tick();
  assert.deepEqual(confirmed, ['AKU']);
});

test('a nickname owned by another device asks for the recovery code, which can be entered and accepted', async () => {
  const tried = [];
  const { scene, confirmed } = sceneWith({
    checkNickname: async () => 'taken',
    recoverNickname: async (nickname, code) => { tried.push([nickname, code]); return code === 'ABCDEFGHJKLMNPQR'; },
  });
  await openList(scene);
  scene.update(1 / 60, fakeInput(['Space']));
  await tick();
  assert.equal(scene.state, 'recovery');
  assert.deepEqual(confirmed, []);

  scene.update(1 / 60, fakeInput([], [...'zzzz-zzzz-zzzz-zzzz']));
  scene.update(1 / 60, fakeInput(['Enter']));
  await tick();
  assert.equal(scene.state, 'recovery');
  assert.equal(scene.message, 'VÄÄRÄ KOODI');

  for (let i = 0; i < 16; i++) scene.update(1 / 60, fakeInput(['Backspace']));
  scene.update(1 / 60, fakeInput([], [...'abcd-efgh-jklm-npqr']));
  scene.update(1 / 60, fakeInput(['Enter']));
  await tick();
  assert.deepEqual(tried, [['AKU', 'ZZZZZZZZZZZZZZZZ'], ['AKU', 'ABCDEFGHJKLMNPQR']]);
  assert.deepEqual(confirmed, ['AKU']);
});

test('Enter does nothing until the code is complete, and Escape leaves recovery for the nickname list', async () => {
  const { scene, confirmed, backs } = sceneWith({ checkNickname: async () => 'taken', recoverNickname: async () => true });
  await openList(scene);
  scene.update(1 / 60, fakeInput(['Space']));
  await tick();
  scene.update(1 / 60, fakeInput([], [...'abcd']));
  scene.update(1 / 60, fakeInput(['Enter']));
  await tick();
  assert.deepEqual(confirmed, []);
  scene.update(1 / 60, fakeInput(['Escape']));
  assert.equal(scene.state, 'list');
  assert.equal(backs(), 0);
  scene.render(recordingCtx());
});

test('the recovery screen renders and reports a failing board', async () => {
  const { scene } = sceneWith({
    checkNickname: async () => 'taken',
    recoverNickname: async () => { throw new Error('offline'); },
  });
  await openList(scene);
  scene.update(1 / 60, fakeInput(['Space']));
  await tick();
  scene.update(1 / 60, fakeInput([], [...'abcdefghjklmnpqr']));
  scene.update(1 / 60, fakeInput(['Enter']));
  await tick();
  assert.equal(scene.message, 'PALVELIN EI VASTAA');
  assert.equal(scene.state, 'recovery');
  scene.render(recordingCtx());
});

const competition = {
  nickname: 'AKU',
  eventIds: ['skiJump', 'slalom', 'luge'],
  eventResult: () => ({ points: 30 }),
  total: 90,
  toPayload: () => ({}),
};

async function finalScene(saveResult) {
  const game = { audio: { playSfx() {}, playSong() {} }, repository: { saveResult } };
  const scene = new FinalScene({ game, competition, onDone() {} });
  scene.enter();
  await tick();
  return scene;
}

function draws(scene, text, y, options) {
  const expected = recordingCtx();
  drawText(expected, text, 320, y, { align: 'center', ...options });
  const actual = recordingCtx();
  scene.render(actual);
  const drawn = new Set(actual.rects.map((rect) => JSON.stringify(rect)));
  return expected.rects.every((rect) => drawn.has(JSON.stringify(rect)));
}

test('the final screen shows the recovery code of a shared-board save', async () => {
  const scene = await finalScene(async () => ({ saved: true, remote: true, pushed: false, recoveryCode: 'ABCD-EFGH-JKLM-NPQR' }));
  assert.equal(scene.recoveryCode, 'ABCD-EFGH-JKLM-NPQR');
  assert.ok(draws(scene, 'ABCD-EFGH-JKLM-NPQR', 388, { scale: 2, color: PALETTE.paper }));
  const local = await finalScene(async () => ({ saved: true, local: true }));
  assert.equal(local.recoveryCode, null);
});

test('a nickname taken on the board is reported as taken, not as a plain failure', async () => {
  const scene = await finalScene(async () => { throw new Error('nickname taken'); });
  assert.equal(scene.status, 'taken');
  assert.ok(draws(scene, 'NIMIMERKKI ON VARATTU', 332, { scale: 2, color: PALETTE.red }));
  const failed = await finalScene(async () => { throw new Error('offline'); });
  assert.equal(failed.status, 'failed');
});
