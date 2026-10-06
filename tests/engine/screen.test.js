import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integerScale } from '../../game/engine/screen.js';

test('integerScale picks the largest whole multiple that fits', () => {
  assert.equal(integerScale(1920, 1080), 4);
  assert.equal(integerScale(1280, 1024), 4);
  assert.equal(integerScale(1279, 1024), 3);
});

test('integerScale never goes below 1', () => {
  assert.equal(integerScale(300, 200), 1);
});
