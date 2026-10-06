import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Competition } from '../../game/core/competition.js';

test('runs events in order with three attempts each', () => {
  const competition = new Competition('JOUNI');
  assert.equal(competition.currentEventId, 'skiJump');
  assert.equal(competition.attemptNumber, 1);
  competition.recordAttempt({ valid: true, points: 50, distance: 194.5 });
  competition.recordAttempt({ valid: false, points: 0, distance: 120 });
  assert.equal(competition.attemptNumber, 3);
  assert.equal(competition.isEventComplete(), false);
  competition.recordAttempt({ valid: true, points: 70, distance: 197 });
  assert.equal(competition.isEventComplete(), true);
  assert.throws(() => competition.recordAttempt({ valid: true, points: 1, distance: 171 }), /already complete/);
  competition.advance();
  assert.equal(competition.currentEventId, 'slalom');
  assert.equal(competition.attemptNumber, 1);
  assert.equal(competition.isFinished, false);
  competition.advance();
  competition.advance();
  assert.equal(competition.isFinished, true);
  assert.equal(competition.currentEventId, null);
});

test('total and payload use each event best result', () => {
  const competition = new Competition('JOUNI');
  competition.recordAttempt({ valid: true, points: 70, distance: 197 });
  competition.advance();
  competition.recordAttempt({ valid: true, points: 45, time: 32.1 });
  competition.advance();
  competition.recordAttempt({ valid: false, points: 0, time: 25 });
  competition.advance();
  assert.equal(competition.total, 115);
  assert.deepEqual(competition.toPayload(), {
    nickname: 'JOUNI',
    events: {
      skiJump: { points: 70, distance: 197 },
      slalom: { points: 45, time: 32.1 },
      luge: { points: 0, time: null },
    },
  });
});
