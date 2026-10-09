import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DeviceKeys, formatSecret, generateSecret, isValidSecret, normalizeSecret, SECRET_ALPHABET, SECRET_LENGTH, SecretEntry,
} from '../../game/core/deviceKeys.js';

function memoryStorage() {
  const data = {};
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = String(value); }, data };
}

const fixedBytes = (start) => () => Uint8Array.from({ length: SECRET_LENGTH }, (_, i) => start + i);

test('generated secrets use the unambiguous alphabet and the right length', () => {
  const secret = generateSecret();
  assert.equal(secret.length, SECRET_LENGTH);
  assert.ok(isValidSecret(secret));
  assert.ok(![...'IO01'].some((char) => SECRET_ALPHABET.includes(char)));
  assert.notEqual(generateSecret(), generateSecret());
  assert.equal(generateSecret(fixedBytes(0)), 'ABCDEFGHJKLMNPQR');
});

test('formatSecret groups by four and normalizeSecret undoes typing styles', () => {
  assert.equal(formatSecret('ABCDEFGHJKLMNPQR'), 'ABCD-EFGH-JKLM-NPQR');
  assert.equal(normalizeSecret(' abcd-efgh jklm-npqr '), 'ABCDEFGHJKLMNPQR');
  assert.equal(normalizeSecret('ab0o1i'), 'AB');
  assert.ok(!isValidSecret('SHORT'));
  assert.ok(!isValidSecret(null));
});

test('SecretEntry collects letters and digits up to the code length and ignores the rest', () => {
  const entry = new SecretEntry();
  for (const char of 'abcd-efgh jklm npqr!') entry.append(char);
  assert.equal(entry.value, 'ABCDEFGHJKLMNPQR');
  assert.ok(entry.isComplete);
  assert.equal(entry.append('A'), false);
  entry.backspace();
  assert.ok(!entry.isComplete);
  assert.equal(entry.display, 'ABCD-EFGH-JKLM-NPQ_');
  assert.equal(new SecretEntry().display, '____-____-____-____');
});

test('DeviceKeys creates a code once per nickname, keeps it in storage and can drop it', () => {
  const storage = memoryStorage();
  const keys = new DeviceKeys(storage, fixedBytes(0));
  assert.equal(keys.get('AKU'), null);
  assert.deepEqual(keys.getOrCreate('AKU'), { secret: 'ABCDEFGHJKLMNPQR', created: true });
  assert.deepEqual(keys.getOrCreate('AKU'), { secret: 'ABCDEFGHJKLMNPQR', created: false });
  assert.equal(new DeviceKeys(storage).get('AKU'), 'ABCDEFGHJKLMNPQR');
  keys.set('BEA', 'ZZZZZZZZ22222222');
  assert.equal(keys.remove('AKU'), 'ABCDEFGHJKLMNPQR');
  assert.equal(keys.get('AKU'), null);
  assert.equal(keys.get('BEA'), 'ZZZZZZZZ22222222');
});

test('DeviceKeys works without storage and survives broken or hostile stored data', () => {
  const keys = new DeviceKeys(null, fixedBytes(3));
  const { secret } = keys.getOrCreate('AKU');
  assert.equal(keys.get('AKU'), secret);
  for (const raw of ['not json', '[]', '{"AKU":"short"}']) {
    const storage = { getItem: () => raw, setItem() {} };
    assert.equal(new DeviceKeys(storage).get('AKU'), null);
  }
  const blocked = { getItem: () => null, setItem() { throw new Error('quota'); } };
  const offline = new DeviceKeys(blocked, fixedBytes(0));
  offline.getOrCreate('AKU');
  assert.equal(offline.get('AKU'), null); // storage is read first; nothing was stored
});
