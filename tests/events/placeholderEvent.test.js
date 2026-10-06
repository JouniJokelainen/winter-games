import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../game/engine/rng.js';
import { PlaceholderEventScene, SIMULATORS } from '../../game/events/placeholderEvent.js';
import { MAX_POINTS } from '../../game/core/rules.js';
import { fakeInput } from '../helpers/fakeInput.js';

test('simulators produce attempts that follow the event contract', () => {
  const rng = createRng(123);
  for (let i = 0; i < 200; i++) {
    for (const [eventId, simulate] of Object.entries(SIMULATORS)) {
      const attempt = simulate(rng);
      assert.equal(typeof attempt.valid, 'boolean');
      assert.ok(Number.isInteger(attempt.points));
      assert.ok(attempt.points >= 0 && attempt.points <= MAX_POINTS[eventId]);
      if (!attempt.valid) assert.equal(attempt.points, 0);
      assert.ok(attempt.summary.length > 0);
      if (eventId === 'skiJump') assert.ok(attempt.distance > 0 && attempt.distance <= 200);
      else assert.ok(attempt.time > 0);
    }
  }
});

test('placeholder scene completes exactly once on space', () => {
  const completed = [];
  const game = { audio: { playSfx() {} } };
  const scene = new PlaceholderEventScene({
    game, eventId: 'luge', name: 'OHJASKELKKAILU', onComplete: (a) => completed.push(a), rng: createRng(1),
  });
  scene.update(1 / 60, fakeInput([]));
  assert.equal(completed.length, 0);
  scene.update(1 / 60, fakeInput(['Space']));
  scene.update(1 / 60, fakeInput(['Space']));
  assert.equal(completed.length, 1);
});
