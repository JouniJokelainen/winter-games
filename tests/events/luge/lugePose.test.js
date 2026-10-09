import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOP_RUN_PHASE, HOP_SECONDS, hopPose, liePose, runPose } from '../../../game/events/luge/lugePose.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.h - b.h, a.z - b.z);
const BONES = [['hip', 'kneeL'], ['kneeL', 'ankleL'], ['hip', 'kneeR'], ['kneeR', 'ankleR'], ['shoulderL', 'elbowL'], ['elbowL', 'wristL'], ['shoulderR', 'elbowR'], ['elbowR', 'wristR']];
const close = (a, b, eps = 1e-6) => Object.keys(a).every((key) => (typeof a[key] === 'number' ? Math.abs(a[key] - b[key]) < eps : close(a[key], b[key], eps)));
const JOINTS = ['hip', 'neck', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'toeL', 'toeR'];

test('the hop lasts 0.3 s', () => assert.equal(HOP_SECONDS, 0.3));

test('every pose has the named joints and a head tilt', () => {
  for (const pose of [runPose(0.3, 0.5), liePose(0.2), hopPose(0.5, -0.4)]) {
    for (const joint of JOINTS) assert.ok(pose[joint] && 'x' in pose[joint] && 'h' in pose[joint] && 'z' in pose[joint], joint);
    assert.equal(typeof pose.headTilt, 'number');
  }
});

test('the run cycle is periodic and every joint is a finite number', () => {
  assert.ok(close(runPose(0, 1), runPose(1, 1), 1e-6));
  for (let i = 0; i < 20; i++) {
    const pose = runPose(i / 20, i / 19);
    for (const point of Object.values(pose)) if (typeof point === 'object') assert.ok([point.x, point.h, point.z].every(Number.isFinite));
  }
});

test('bone lengths stay constant (±5 %) through the run cycle, the hop and in the lying pose', () => {
  const lengths = (pose) => BONES.map(([a, b]) => dist(pose[a], pose[b]));
  const base = lengths(runPose(0, 0.5));
  const poses = [];
  for (let i = 0; i < 16; i++) poses.push(runPose(i / 16, 0.5));
  for (let i = 0; i <= 10; i++) poses.push(hopPose(i / 10, 0.3));
  poses.push(liePose(0), liePose(1), liePose(-1));
  for (const pose of poses) lengths(pose).forEach((length, i) => assert.ok(Math.abs(length / base[i] - 1) < 0.05, `bone ${BONES[i]} ${length} vs ${base[i]}`));
});

test('the hop starts from the running pose and ends in the lying pose', () => {
  assert.ok(close(hopPose(0, 0.4), runPose(HOP_RUN_PHASE, 1), 1e-6));
  assert.ok(close(hopPose(1, 0.4), liePose(0.4), 1e-6));
});

test('the hop lifts the hips above both the running and the lying height in the middle', () => {
  const mid = hopPose(0.5, 0).hip.h;
  assert.ok(mid > hopPose(0, 0).hip.h && mid > hopPose(1, 0).hip.h);
});

test('the runner leans further forward at a higher push speed', () => {
  const lean = (pose) => Math.atan2(pose.neck.h - pose.hip.h, pose.neck.z - pose.hip.z);
  assert.ok(lean(runPose(0.25, 1)) < lean(runPose(0.25, 0)));
});

test('the lying pose lies on the deck and is symmetric without lean; leaning tilts the head toward the inside', () => {
  const pose = liePose(0);
  for (const point of Object.values(pose)) if (typeof point === 'object') assert.ok(point.h >= 0 && point.h < 0.7);
  assert.ok(Math.abs(pose.shoulderL.h - pose.shoulderR.h) < 1e-9);
  assert.ok(Math.abs(pose.shoulderL.x + pose.shoulderR.x) < 1e-9);
  assert.ok(liePose(1).headTilt > liePose(0).headTilt && liePose(-1).headTilt < liePose(0).headTilt);
  // A right turn (+) drops the right (inner) shoulder.
  assert.ok(liePose(1).shoulderR.h < liePose(1).shoulderL.h);
});
