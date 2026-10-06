import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../../game/engine/input.js';

function key(code, keyValue = '', repeat = false) {
  return { code, key: keyValue, repeat, prevented: false, preventDefault() { this.prevented = true; } };
}

test('keydown sets down and pressed, endFrame clears only pressed', () => {
  const input = new Input();
  input.onKeyDown(key('Space', ' '));
  assert.equal(input.isDown('Space'), true);
  assert.equal(input.wasPressed('Space'), true);
  input.endFrame();
  assert.equal(input.wasPressed('Space'), false);
  assert.equal(input.isDown('Space'), true);
  input.onKeyUp(key('Space'));
  assert.equal(input.isDown('Space'), false);
});

test('auto-repeat does not create new presses', () => {
  const input = new Input();
  input.onKeyDown(key('ArrowLeft'));
  input.endFrame();
  input.onKeyDown(key('ArrowLeft', '', true));
  assert.equal(input.wasPressed('ArrowLeft'), false);
});

test('game keys prevent default browser behaviour, others do not', () => {
  const input = new Input();
  const space = key('Space', ' ');
  const letter = key('KeyA', 'a');
  input.onKeyDown(space);
  input.onKeyDown(letter);
  assert.equal(space.prevented, true);
  assert.equal(letter.prevented, false);
});

test('typed characters are collected and drained', () => {
  const input = new Input();
  input.onKeyDown(key('KeyA', 'a'));
  input.onKeyDown(key('Quote', 'ä'));
  input.onKeyDown(key('Enter', 'Enter'));
  assert.deepEqual(input.takeTyped(), ['a', 'ä']);
  assert.deepEqual(input.takeTyped(), []);
});

test('reset clears held keys', () => {
  const input = new Input();
  input.onKeyDown(key('ArrowRight'));
  input.reset();
  assert.equal(input.isDown('ArrowRight'), false);
});

test('endFrame clears typed characters that were not taken', () => {
  const input = new Input();
  input.onKeyDown(key('KeyA', 'a'));
  input.endFrame();
  assert.deepEqual(input.takeTyped(), []);
});
