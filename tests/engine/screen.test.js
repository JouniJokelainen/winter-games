import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displaySteps } from '../../game/engine/screen.js';

test('displaySteps picks the largest whole multiple of the logical screen that fits', () => {
  assert.equal(displaySteps(1920, 1080), 4);
  assert.equal(displaySteps(1920, 950), 3);
  assert.equal(displaySteps(1366, 700), 2);
  assert.equal(displaySteps(1279, 1024), 3);
});

test('displaySteps never goes below 1', () => {
  assert.equal(displaySteps(300, 200), 1);
});
