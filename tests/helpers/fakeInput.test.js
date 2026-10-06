import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeInput } from './fakeInput.js';

test('fakeInput counts repeated pressed codes', () => {
  const input = fakeInput(['Space', 'Space', 'Space']);
  assert.equal(input.pressCount('Space'), 3);
  assert.equal(input.wasPressed('Space'), true);
  assert.equal(input.pressCount('Enter'), 0);
});

test('fakeInput holds pressed codes by default, or exactly the held list when given', () => {
  assert.equal(fakeInput(['ArrowLeft']).isDown('ArrowLeft'), true);
  const input = fakeInput(['Space'], [], { held: ['ArrowRight'] });
  assert.equal(input.isDown('ArrowRight'), true);
  assert.equal(input.wasPressed('ArrowRight'), false);
  assert.equal(input.isDown('Space'), false);
});
