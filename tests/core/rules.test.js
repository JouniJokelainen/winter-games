import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidNickname, normalizeNickname } from '../../game/core/rules.js';

test('normalizeNickname trims and uppercases', () => {
  assert.equal(normalizeNickname('  jöni '), 'JÖNI');
  assert.equal(normalizeNickname(undefined), '');
});

test('isValidNickname accepts A-Z, ÄÖÅ and digits up to 10 chars', () => {
  assert.equal(isValidNickname('ÄIJÄ2026'), true);
  assert.equal(isValidNickname('ABCDEFGHIJ'), true);
});

test('isValidNickname rejects empty, too long and other characters', () => {
  for (const bad of ['', 'ABCDEFGHIJK', 'A B', 'abc', 'A-1', 42]) {
    assert.equal(isValidNickname(bad), false, String(bad));
  }
});
