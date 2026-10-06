import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../game/engine/rng.js';

test('same seed gives the same sequence in [0, 1)', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 100; i++) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});

test('different seeds give different sequences', () => {
  assert.notEqual(createRng(1)(), createRng(2)());
});
