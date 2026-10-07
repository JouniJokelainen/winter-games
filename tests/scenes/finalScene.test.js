import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawText } from '../../game/engine/font.js';
import { PALETTE } from '../../game/engine/palette.js';
import { FinalScene } from '../../game/scenes/finalScene.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

const competition = {
  nickname: 'AKU',
  eventIds: ['skiJump', 'slalom', 'luge'],
  eventResult: () => ({ points: 30 }),
  total: 90,
  toPayload: () => ({}),
};

async function finishedScene(response) {
  const game = { audio: { playSfx() {} }, repository: { saveResult: async () => response } };
  const scene = new FinalScene({ game, competition, onDone() {} });
  scene.enter();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return scene;
}

function drawsStatusText(scene, text) {
  const expected = recordingCtx();
  drawText(expected, text, 320, 332, { align: 'center', scale: 2, color: PALETTE.paper });
  const actual = recordingCtx();
  scene.render(actual);
  const drawn = new Set(actual.rects.map((rect) => JSON.stringify(rect)));
  return expected.rects.every((rect) => drawn.has(JSON.stringify(rect)));
}

test('a local save says the result was stored in the browser', async () => {
  const scene = await finishedScene({ saved: true, local: true, pushed: false });
  assert.equal(scene.status, 'local');
  assert.ok(drawsStatusText(scene, 'TULOS TALLENNETTU SELAIMEEN'));
});

test('server saves keep their published and saved statuses', async () => {
  const published = await finishedScene({ saved: true, pushed: true });
  assert.equal(published.status, 'published');
  assert.ok(drawsStatusText(published, 'TULOS TALLENNETTU JA JULKAISTU'));
  const saved = await finishedScene({ saved: true, pushed: false });
  assert.equal(saved.status, 'saved');
  assert.ok(drawsStatusText(saved, 'TULOS TALLENNETTU (EI JULKAISTU)'));
});
