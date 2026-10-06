import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixedStepper } from '../../game/engine/loop.js';

test('runs one tick per whole step and carries the remainder', () => {
  const advance = createFixedStepper(0.25);
  const ticks = [];
  assert.equal(advance(0.5, (dt) => ticks.push(dt)), 2);
  assert.equal(advance(0.125, (dt) => ticks.push(dt)), 0);
  assert.equal(advance(0.125, (dt) => ticks.push(dt)), 1);
  assert.deepEqual(ticks, [0.25, 0.25, 0.25]);
});

test('clamps long pauses to maxSteps', () => {
  const advance = createFixedStepper(0.25, 5);
  assert.equal(advance(10, () => {}), 5);
});
