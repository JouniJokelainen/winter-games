import { fakeInput } from './fakeInput.js';
import { BOTS, botInput } from './slalomBot.js';

const GENERIC_PUSH_INTERVAL = 10;

// Per-event input drivers; extend this map when an event needs real steering to produce valid attempts.
const DRIVERS = {
  slalom: (scene, tick) => botInput(scene.state, BOTS.excellent, tick),
};

export function inputForEvent(eventId, scene, tick) {
  const driver = DRIVERS[eventId];
  if (driver) return driver(scene, tick);
  return fakeInput(tick % GENERIC_PUSH_INTERVAL === 0 ? ['Space'] : []);
}
