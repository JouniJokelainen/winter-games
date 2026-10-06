import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InfoScene } from '../../game/scenes/infoScene.js';
import { fakeInput } from '../helpers/fakeInput.js';

function makeScene(options = {}) {
  const calls = [];
  const game = { audio: { playSfx() {} } };
  const scene = new InfoScene({ game, title: 'X', lines: [], onContinue: () => calls.push(1), ...options });
  return { scene, calls };
}

test('presses before the lockout are ignored, later ones accepted', () => {
  const { scene, calls } = makeScene();
  scene.update(0.3, fakeInput(['Space']));
  scene.update(0.2, fakeInput(['Enter']));
  assert.equal(calls.length, 0);
  scene.update(0.2, fakeInput(['Space']));
  assert.equal(calls.length, 1);
});

test('minShowSeconds is configurable', () => {
  const { scene, calls } = makeScene({ minShowSeconds: 0 });
  scene.update(1 / 60, fakeInput(['Space']));
  assert.equal(calls.length, 1);
});
