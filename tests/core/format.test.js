import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeEventResult, formatDistance, formatTime } from '../../game/core/format.js';

test('formatTime uses two decimals and a Finnish decimal comma', () => {
  assert.equal(formatTime(31.256), '31,26 S');
  assert.equal(formatTime(29), '29,00 S');
});

test('formatDistance uses one decimal and a Finnish decimal comma', () => {
  assert.equal(formatDistance(187.46), '187,5 M');
  assert.equal(formatDistance(200), '200,0 M');
});

test('describeEventResult describes the best result or its absence', () => {
  assert.equal(describeEventResult('skiJump', { points: 60, distance: 190 }), 'PITUUS 190,0 M');
  assert.equal(describeEventResult('luge', { points: 40, time: 33.2 }), 'AIKA 33,20 S');
  assert.equal(describeEventResult('skiJump', { points: 0, distance: null }), 'EI ONNISTUNUTTA HYPPYÄ');
  assert.equal(describeEventResult('slalom', { points: 0, time: null }), 'EI HYVÄKSYTTYÄ LASKUA');
});
