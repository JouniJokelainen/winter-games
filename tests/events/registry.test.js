import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS } from '../../game/events/registry.js';
import { EVENT_IDS } from '../../game/core/rules.js';

test('registry has every event with name, instructions and a scene factory', () => {
  assert.deepEqual(Object.keys(EVENTS), EVENT_IDS);
  for (const eventId of EVENT_IDS) {
    const event = EVENTS[eventId];
    assert.equal(event.id, eventId);
    assert.match(event.name, /^[A-ZÄÖÅ]+$/);
    assert.ok(event.instructions.length > 0);
    const scene = event.createScene({ game: { audio: { playSfx() {} } }, mode: 'practice', attemptNumber: 1, onComplete() {} });
    assert.equal(typeof scene.update, 'function');
    assert.equal(typeof scene.render, 'function');
  }
});
