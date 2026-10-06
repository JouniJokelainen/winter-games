import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteToFreq, parsePattern } from '../../game/audio/sequencer.js';

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
