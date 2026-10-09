import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteToFreq, parsePattern, Sequencer } from '../../game/audio/sequencer.js';

test('noteToFreq uses A4 = 440 Hz equal temperament', () => {
  assert.equal(noteToFreq('A4'), 440);
  assert.ok(Math.abs(noteToFreq('C4') - 261.63) < 0.01);
  assert.ok(Math.abs(noteToFreq('A#4') - 466.16) < 0.01);
  assert.ok(Math.abs(noteToFreq('A3') - 220) < 1e-9);
});

test('noteToFreq rejects invalid notes', () => {
  for (const bad of ['H4', 'E#4', 'Bb4', 'C', '']) assert.throws(() => noteToFreq(bad), /invalid note/);
});

test('parsePattern handles notes, rests and holds', () => {
  const { notes, length } = parsePattern('C4 - . E4\n G4');
  assert.equal(length, 5);
  assert.deepEqual(notes.map(({ step, length: l }) => [step, l]), [[0, 2], [3, 1], [4, 1]]);
  assert.equal(notes[1].freq, noteToFreq('E4'));
});

test('parsePattern rejects a hold without a note', () => {
  assert.throws(() => parsePattern('. -'), /hold without note/);
  assert.throws(() => parsePattern('- C4'), /hold without note/);
});

test('schedule resyncs after the clock ran ahead of the queue', () => {
  const ctx = { currentTime: 100 };
  const audio = { ctx, tone() {} };
  const sequencer = new Sequencer(audio, { bpm: 120, stepsPerBeat: 2, channels: [{ wave: 'square', volume: 0.1, pattern: 'C4 - . D4' }] });
  sequencer.nextLoopTime = 1;
  let tones = 0;
  audio.tone = () => { tones++; };
  sequencer.schedule();
  assert.ok(sequencer.nextLoopTime > 100);
  assert.ok(tones < 10);
});

function recordingAudio() {
  const tones = [];
  const noises = [];
  const audio = {
    ctx: { currentTime: 0, createGain: () => ({ connect() {}, disconnect() {} }) },
    music: {},
    tone: (note) => tones.push(note),
    noise: (hit) => noises.push(hit),
  };
  return { audio, tones, noises };
}

test('noise channels play filtered noise at the note pitch, with short hits', () => {
  const { audio, tones, noises } = recordingAudio();
  const sequencer = new Sequencer(audio, { bpm: 60, stepsPerBeat: 1, channels: [{ wave: 'noise', volume: 0.1, pattern: 'C3 - - . G6' }] });
  sequencer.start();
  sequencer.stop();
  assert.equal(tones.length, 0);
  assert.equal(noises[0].filterFreq, noteToFreq('C3'));
  assert.equal(noises[1].filterFreq, noteToFreq('G6'));
  assert.ok(noises[0].duration <= 0.1);
  assert.ok(Math.abs(noises[1].at - noises[0].at - 4) < 1e-9);
});

test('a song with loop: false is scheduled once', () => {
  const { audio, tones } = recordingAudio();
  const sequencer = new Sequencer(audio, { bpm: 600, stepsPerBeat: 1, loop: false, channels: [{ wave: 'square', volume: 0.1, pattern: 'C4 D4' }] });
  sequencer.start();
  audio.ctx.currentTime = 50;
  sequencer.schedule();
  sequencer.stop();
  assert.equal(tones.length, 2);
});
