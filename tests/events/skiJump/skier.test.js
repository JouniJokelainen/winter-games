import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawSkier, POSES, SKIER_STYLES, skierSilhouette } from '../../../game/events/skiJump/skier.js';

const DEG = Math.PI / 180;

function recordingCtx() {
  const pixels = [];
  return {
    pixels,
    fillStyle: null,
    fillRect(x, y, w, h) {
      for (const value of [x, y, w, h]) {
        if (!Number.isFinite(value)) throw new Error(`non-finite rect value ${value}`);
      }
      pixels.push({ x, y, color: this.fillStyle });
    },
  };
}

test('every pose draws a skier with skis, suit and helmet colours', () => {
  const style = SKIER_STYLES.classic;
  for (const pose of Object.keys(POSES)) {
    const ctx = recordingCtx();
    drawSkier(ctx, style, pose, 100, 100, pose === 'crouch' ? -35 * DEG : 0.6);
    const colors = new Set(ctx.pixels.map((p) => p.color));
    for (const color of [style.ski, style.torso, style.legs, style.helmet.color]) {
      assert.ok(colors.has(color), `${pose} misses ${color}`);
    }
    assert.ok(ctx.pixels.length > 200, `${pose}: ${ctx.pixels.length} pixels`);
  }
});

test('the classic helmet has no white: pompom and helmet are red', () => {
  const { helmet } = SKIER_STYLES.classic;
  assert.equal(helmet.pompom, helmet.color);
});

test('bindings sit at the middle of the skis (telemark a bit behind the middle)', () => {
  for (const pose of ['crouch', 'flight']) {
    const { skiTail, skiTip } = POSES[pose];
    assert.ok(Math.abs(skiTail + skiTip) <= 6, `${pose}: tail ${skiTail}, tip ${skiTip}`);
  }
  const { skiTail, skiTip } = POSES.telemark;
  assert.ok(skiTip > -skiTail, 'telemark: more ski in front of the boots than behind');
});

test('flight skis open in a V below the body', () => {
  const { skis, body } = skierSilhouette('flight', 0, 0, 0);
  assert.equal(skis.length, 2);
  const [boots, head] = body;
  assert.ok(head[0] > boots[0], 'head ahead of the boots');
  for (const [tail, tip] of skis) {
    assert.ok(tip[0] > 0 && tail[0] < 0, 'skis reach in front of and behind the boots');
    assert.ok(tip[1] > head[1], 'ski tips are below the head on screen');
  }
  assert.notEqual(skis[0][1][1], skis[1][1][1]);
});

test('silhouette rotates with the pose angle', () => {
  const flat = skierSilhouette('flight', 0, 0, 0).body[1];
  const steep = skierSilhouette('flight', 0, 0, 45 * DEG).body[1];
  assert.ok(steep[1] < flat[1], 'head rises on screen when the body is more upright');
});
