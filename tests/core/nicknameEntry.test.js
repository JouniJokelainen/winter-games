import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NicknameEntry } from '../../game/core/nicknameEntry.js';

test('append uppercases allowed characters and rejects others', () => {
  const entry = new NicknameEntry();
  assert.equal(entry.append('j'), true);
  assert.equal(entry.append('ö'), true);
  assert.equal(entry.append('1'), true);
  assert.equal(entry.append(' '), false);
  assert.equal(entry.append('-'), false);
  assert.equal(entry.append('ß'), false);
  assert.equal(entry.value, 'JÖ1');
});

test('append stops at 10 characters', () => {
  const entry = new NicknameEntry();
  for (const char of 'ABCDEFGHIJ') entry.append(char);
  assert.equal(entry.append('K'), false);
  assert.equal(entry.value, 'ABCDEFGHIJ');
});

test('backspace and isValid', () => {
  const entry = new NicknameEntry();
  assert.equal(entry.isValid, false);
  entry.append('A');
  assert.equal(entry.isValid, true);
  entry.backspace();
  entry.backspace();
  assert.equal(entry.value, '');
  assert.equal(entry.isValid, false);
});
