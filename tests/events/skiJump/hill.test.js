import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HILL, hillHeightAt, inrunHeightAt, inrunPointAt, INRUN_ANGLE, LIP_ANGLE,
} from '../../../game/events/skiJump/hill.js';

test('landing hill starts at the lip and descends monotonically', () => {
  assert.equal(hillHeightAt(HILL, 0), 0);
  let previous = 0;
  for (let x = 1; x <= HILL.outrunEnd; x++) {
    const height = hillHeightAt(HILL, x);
    assert.ok(height <= previous, `height rises at x=${x}`);
    previous = height;
  }
});

test('hillHeightAt interpolates between profile points and clamps outside', () => {
  assert.equal(hillHeightAt(HILL, 100), -55);
  assert.equal(hillHeightAt(HILL, 135), -77.5);
  assert.equal(hillHeightAt(HILL, -10), 0);
  assert.equal(hillHeightAt(HILL, 1000), -118);
});

test('inrun path starts at inrunStart and ends exactly at the lip', () => {
  const start = inrunPointAt(HILL, 0);
  const end = inrunPointAt(HILL, HILL.inrunLength);
  assert.deepEqual([start.x, start.y], [HILL.inrunStart.x, HILL.inrunStart.y]);
  assert.ok(Math.abs(end.x) < 1e-9 && Math.abs(end.y) < 1e-9);
  assert.ok(HILL.inrunStart.x < 0 && HILL.inrunStart.y > 0);
});

test('inrun is a straight 35° ramp that curves into the 11° takeoff table', () => {
  const DEG = Math.PI / 180;
  assert.ok(Math.abs(inrunPointAt(HILL, 0).angle + INRUN_ANGLE) < 1e-9);
  assert.ok(Math.abs(inrunPointAt(HILL, 20).angle + INRUN_ANGLE) < 1e-9);
  assert.ok(Math.abs(inrunPointAt(HILL, HILL.inrunLength).angle - LIP_ANGLE) < 0.01 * DEG);
  let previous = -Infinity;
  for (let s = 0; s <= HILL.inrunLength; s += 1) {
    const { angle } = inrunPointAt(HILL, s);
    assert.ok(angle >= previous - 1e-9, `angle decreases at ${s} m`);
    previous = angle;
  }
});

test('inrunHeightAt follows the path and inrunPointAt clamps outside it', () => {
  const mid = inrunPointAt(HILL, 30);
  assert.ok(Math.abs(inrunHeightAt(HILL, mid.x) - mid.y) < 0.01);
  assert.equal(inrunHeightAt(HILL, 0), 0);
  assert.deepEqual(inrunPointAt(HILL, -5), inrunPointAt(HILL, 0));
  assert.deepEqual(inrunPointAt(HILL, 99), inrunPointAt(HILL, HILL.inrunLength));
});

test('K-point and hill size are on the landing hill', () => {
  assert.equal(HILL.kPoint, 170);
  assert.equal(HILL.hillSize, 200);
  assert.ok(HILL.outrunEnd > HILL.hillSize);
});
