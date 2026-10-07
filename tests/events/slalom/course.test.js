import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COURSE, COURSE_CENTER_X } from '../../../game/events/slalom/course.js';

test('course has 23 poles alternating red-left and blue-right', () => {
  assert.equal(COURSE.poles.length, 23);
  COURSE.poles.forEach((pole, index) => {
    assert.equal(pole.side, index % 2 === 0 ? 'left' : 'right');
    assert.equal(pole.color, pole.side === 'left' ? 'red' : 'blue');
  });
});

test('poles go downhill inside the fences, finish after the last pole', () => {
  for (let i = 1; i < COURSE.poles.length; i++) assert.ok(COURSE.poles[i].y > COURSE.poles[i - 1].y);
  for (const pole of COURSE.poles) assert.ok(pole.x > COURSE.fenceLeftX + 20 && pole.x < COURSE.fenceRightX - 20);
  assert.ok(COURSE.finishY > COURSE.poles.at(-1).y + 200);
  assert.equal(COURSE.startX, COURSE_CENTER_X);
});

test('a straight run down the centerline would pass every off-center pole on the wrong side', () => {
  for (const pole of COURSE.poles.filter((p) => p.x !== COURSE_CENTER_X)) {
    const skierIsLeftOfPole = COURSE_CENTER_X < pole.x;
    assert.notEqual(skierIsLeftOfPole, pole.side === 'left', `pole at ${pole.x},${pole.y}`);
  }
});
