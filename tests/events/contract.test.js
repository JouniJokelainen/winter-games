import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Competition } from '../../game/core/competition.js';
import { ATTEMPTS_PER_EVENT } from '../../game/core/rules.js';
import { EVENTS } from '../../game/events/registry.js';
import { validateResult } from '../../game/core/leaderboard.js';
import { inputForEvent } from '../helpers/eventDrivers.js';

function playAttempt(eventId, attemptNumber) {
  const game = { audio: { playSfx() {} } };
  let attempt = null;
  const scene = EVENTS[eventId].createScene({
    game, mode: 'competition', attemptNumber, onComplete: (a) => { attempt = a; },
  });
  // Drive the scene with its per-event input driver and small steps until it completes.
  for (let tick = 0; tick < 60 * 120 && !attempt; tick++) {
    scene.update(1 / 60, inputForEvent(eventId, scene, tick));
  }
  assert.ok(attempt, `${eventId} did not complete`);
  return attempt;
}

test('every registered event produces attempts the server accepts', () => {
  const validAttempts = { skiJump: 0, slalom: 0 };
  for (let round = 0; round < 20; round++) {
    const competition = new Competition('AKU');
    for (const eventId of competition.eventIds) {
      assert.ok(EVENTS[eventId], `${eventId} is registered`);
      for (let n = 1; n <= ATTEMPTS_PER_EVENT; n++) {
        const attempt = playAttempt(eventId, n);
        if (attempt.valid && eventId in validAttempts) validAttempts[eventId] += 1;
        competition.recordAttempt(attempt);
      }
      competition.advance();
    }
    const check = validateResult(competition.toPayload());
    assert.equal(check.ok, true, JSON.stringify(check));
  }
  for (const [eventId, count] of Object.entries(validAttempts)) {
    assert.ok(count > 0, `at least one valid ${eventId} attempt reached the server check`);
  }
});
