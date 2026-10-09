import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../../game/audio/audioEngine.js';
import { AudioOptionsScene } from '../../game/scenes/audioOptionsScene.js';
import { fakeInput } from '../helpers/fakeInput.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = String(value); }, data };
}

function withFakeAudioContext(run) {
  const gains = [];
  class FakeContext {
    constructor() {
      this.destination = {};
      this.sampleRate = 8000;
      this.currentTime = 0;
      this.state = 'running';
    }

    createGain() {
      const node = { gain: { value: 1 }, connect() { return node; } };
      gains.push(node);
      return node;
    }

    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
  }
  globalThis.AudioContext = FakeContext;
  try {
    return run(gains);
  } finally {
    delete globalThis.AudioContext;
  }
}

test('settings default to music on at full volume and survive a reload', () => {
  const storage = memoryStorage();
  const audio = new AudioEngine(storage);
  assert.deepEqual(audio.settings, { musicOn: true, music: 1, sfx: 1 });
  audio.setMusicOn(false);
  audio.setMusicVolume(0.44);
  audio.setSfxVolume(2);
  assert.deepEqual(new AudioEngine(storage).settings, { musicOn: false, music: 0.4, sfx: 1 });
});

test('broken or out-of-range saved settings fall back to safe values', () => {
  assert.deepEqual(new AudioEngine(memoryStorage({ 'winterGames.audioSettings': 'nope' })).settings, { musicOn: true, music: 1, sfx: 1 });
  const odd = JSON.stringify({ musicOn: 'yes', music: 7, sfx: -3 });
  assert.deepEqual(new AudioEngine(memoryStorage({ 'winterGames.audioSettings': odd })).settings, { musicOn: true, music: 1, sfx: 0 });
});

test('the music and effects buses follow the settings', () => {
  withFakeAudioContext((gains) => {
    const audio = new AudioEngine(memoryStorage());
    audio.unlock();
    const [master, music, sfx] = gains;
    assert.ok(audio.music === music && audio.sfx === sfx && audio.master === master);
    assert.ok(music.gain.value > sfx.gain.value);
    audio.setMusicOn(false);
    assert.equal(music.gain.value, 0);
    audio.setMusicOn(true);
    audio.setSfxVolume(0.5);
    assert.ok(music.gain.value > 0);
    assert.ok(Math.abs(sfx.gain.value - 0.5 * 0.65) < 1e-9);
  });
});

function optionsScene() {
  const sounds = [];
  const audio = new AudioEngine(memoryStorage());
  audio.playSfx = (name) => sounds.push(name);
  let backs = 0;
  const scene = new AudioOptionsScene({ game: { audio }, onBack: () => { backs++; } });
  return { scene, audio, sounds, backs: () => backs };
}

test('the options scene toggles the music and adjusts the volumes in steps of ten percent', () => {
  const { scene, audio } = optionsScene();
  scene.update(1 / 60, fakeInput(['Space']));
  assert.equal(audio.settings.musicOn, false);
  scene.update(1 / 60, fakeInput(['ArrowDown']));
  scene.update(1 / 60, fakeInput(['ArrowLeft']));
  scene.update(1 / 60, fakeInput(['ArrowLeft']));
  assert.equal(audio.settings.music, 0.8);
  scene.update(1 / 60, fakeInput(['ArrowRight']));
  assert.equal(audio.settings.music, 0.9);
  scene.update(1 / 60, fakeInput(['ArrowDown']));
  scene.update(1 / 60, fakeInput(['ArrowLeft']));
  assert.equal(audio.settings.sfx, 0.9);
  assert.equal(audio.settings.musicOn, false);
});

test('the options scene goes back from the back item and from Escape, and renders', () => {
  const first = optionsScene();
  for (let i = 0; i < 3; i++) first.scene.update(1 / 60, fakeInput(['ArrowDown']));
  first.scene.update(1 / 60, fakeInput(['Space']));
  assert.equal(first.backs(), 1);
  const second = optionsScene();
  second.scene.update(1 / 60, fakeInput(['Escape']));
  assert.equal(second.backs(), 1);
  second.scene.render(recordingCtx());
});
