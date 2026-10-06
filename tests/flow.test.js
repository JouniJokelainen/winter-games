import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SceneManager } from '../game/engine/sceneManager.js';
import { createFlow } from '../game/flow.js';
import { SlalomScene } from '../game/events/slalom/slalomScene.js';
import { inputForEvent } from './helpers/eventDrivers.js';
import { fakeInput } from './helpers/fakeInput.js';

function fakeGame() {
  const saved = [];
  return {
    saved,
    scenes: new SceneManager(),
    audio: { muted: false, playSfx() {}, playSong() {}, stopSong() {}, toggleMuted() { this.muted = !this.muted; } },
    repository: {
      getNicknames: async () => ['AKU'],
      saveResult: async (payload) => { saved.push(payload); return { saved: true, committed: true, pushed: true }; },
    },
  };
}

// Advances past the InfoScene input lockout before applying the key press.
const tick = (game, codes = []) => {
  game.scenes.update(0.7, fakeInput([]));
  game.scenes.update(1 / 60, fakeInput(codes));
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

// Drives the current event scene (per-event driver) until it hands over to the result screen.
function finishAttempt(game) {
  const eventScene = game.scenes.current;
  const eventId = eventScene instanceof SlalomScene ? 'slalom' : 'other';
  for (let i = 0; i < 60 * 120 && game.scenes.current === eventScene; i++) {
    game.scenes.update(1 / 60, inputForEvent(eventId, eventScene, i));
  }
}

test('a full competition posts one result', async () => {
  const game = fakeGame();
  const flow = createFlow(game);
  flow.toTitle();
  tick(game, ['Space']);                 // KILPAILU
  await flush();                         // nickname list loads
  tick(game, ['Space']);                 // pick AKU
  for (let event = 0; event < 3; event++) {
    tick(game, ['Space']);               // event intro
    for (let attempt = 0; attempt < 3; attempt++) {
      finishAttempt(game);               // event attempt (placeholder or real)
      tick(game, ['Space']);             // attempt result
    }
    tick(game, ['Space']);               // event summary
  }
  await flush();                         // final scene saves
  assert.equal(game.saved.length, 1);
  assert.equal(game.saved[0].nickname, 'AKU');
  assert.deepEqual(Object.keys(game.saved[0].events), ['skiJump', 'slalom', 'luge']);
  tick(game, ['Space']);                 // back to title
  assert.equal(game.scenes.current.constructor.name, 'TitleScene');
});

test('escape opens the pause menu in an event and LOPETA returns to title', () => {
  const game = fakeGame();
  const flow = createFlow(game);
  flow.toTitle();
  tick(game, ['ArrowDown']);
  tick(game, ['Space']);                 // HARJOITTELU
  tick(game, ['Space']);                 // MÄKIHYPPY
  tick(game, ['Space']);                 // practice intro
  assert.equal(game.scenes.current.constructor.name, 'PlaceholderEventScene');
  assert.equal(flow.handleGlobalKeys(fakeInput(['Escape'])), true);
  assert.equal(game.scenes.current.constructor.name, 'PauseScene');
  tick(game, ['ArrowDown']);
  tick(game, ['ArrowDown']);
  tick(game, ['Space']);                 // LOPETA
  assert.equal(game.scenes.current.constructor.name, 'PracticeSelectScene');
});

test('escape is ignored on scenes without a pause target', () => {
  const game = fakeGame();
  const flow = createFlow(game);
  flow.toTitle();
  assert.equal(flow.handleGlobalKeys(fakeInput(['Escape'])), false);
});

test('escape opens the pause menu on competition info scenes', async () => {
  const game = fakeGame();
  const flow = createFlow(game);
  flow.toTitle();
  tick(game, ['Space']);                 // KILPAILU
  await flush();
  tick(game, ['Space']);                 // pick AKU -> event intro
  assert.equal(game.scenes.current.constructor.name, 'InfoScene');
  assert.equal(flow.handleGlobalKeys(fakeInput(['Escape'])), true);
  assert.equal(game.scenes.current.constructor.name, 'PauseScene');
  tick(game, ['ArrowDown']);
  tick(game, ['ArrowDown']);
  tick(game, ['Space']);                 // LOPETA
  assert.equal(game.scenes.current.constructor.name, 'TitleScene');
});
