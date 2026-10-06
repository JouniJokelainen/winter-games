import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestAttempt, eventResult, lugePoints, overtimeSeconds, skiJumpPoints, slalomPoints,
} from '../../game/core/scoring.js';

test('skiJumpPoints: 200 m perfect landing is the maximum 80', () => {
  assert.equal(skiJumpPoints(200, 'perfect'), 80);
});

test('skiJumpPoints: each full metre under 200 costs 2 points', () => {
  assert.equal(skiJumpPoints(199.9, 'perfect'), 78);
  assert.equal(skiJumpPoints(199, 'poor'), 63);
  assert.equal(skiJumpPoints(170, 'perfect'), 20);
});

test('skiJumpPoints: distance points floor at 0, fall gives 0', () => {
  assert.equal(skiJumpPoints(150, 'poor'), 5);
  assert.equal(skiJumpPoints(195, 'fall'), 0);
});

test('overtimeSeconds counts every started second over 30', () => {
  assert.equal(overtimeSeconds(29.5), 0);
  assert.equal(overtimeSeconds(30), 0);
  assert.equal(overtimeSeconds(30.01), 1);
  assert.equal(overtimeSeconds(31), 1);
  assert.equal(overtimeSeconds(31.5), 2);
});

test('slalomPoints subtracts overtime, hits and missed poles, floors at 0', () => {
  assert.equal(slalomPoints({ time: 30, hits: 0, missed: 0 }), 60);
  assert.equal(slalomPoints({ time: 32.4, hits: 1, missed: 1 }), 15);
  assert.equal(slalomPoints({ time: 45, hits: 3, missed: 1 }), 0);
});

test('lugePoints subtracts overtime only', () => {
  assert.equal(lugePoints(28), 60);
  assert.equal(lugePoints(33.2), 40);
  assert.equal(lugePoints(60), 0);
});

test('bestAttempt ski jump: highest points, then longest distance, invalid ignored', () => {
  const attempts = [
    { valid: true, points: 60, distance: 190 },
    { valid: false, points: 0, distance: 199 },
    { valid: true, points: 60, distance: 190.5 },
  ];
  assert.equal(bestAttempt('skiJump', attempts), attempts[2]);
});

test('bestAttempt slalom prefers points over raw speed', () => {
  const attempts = [
    { valid: true, points: 40, time: 29 },
    { valid: true, points: 50, time: 31 },
  ];
  assert.equal(bestAttempt('slalom', attempts), attempts[1]);
});

test('bestAttempt luge picks the fastest valid run', () => {
  const attempts = [
    { valid: true, points: 45, time: 32.5 },
    { valid: false, points: 0, time: 20 },
    { valid: true, points: 50, time: 31.9 },
  ];
  assert.equal(bestAttempt('luge', attempts), attempts[2]);
});

test('bestAttempt returns null when nothing is valid', () => {
  assert.equal(bestAttempt('luge', [{ valid: false, points: 0, time: 30 }]), null);
});

test('eventResult returns points and metric of the best attempt or zero with null metric', () => {
  assert.deepEqual(eventResult('skiJump', [{ valid: true, points: 62, distance: 196.5 }]), { points: 62, distance: 196.5 });
  assert.deepEqual(eventResult('slalom', []), { points: 0, time: null });
});
