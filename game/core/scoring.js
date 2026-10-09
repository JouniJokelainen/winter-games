import { METRIC_KEY, SKI_JUMP_MAX_DISTANCE, TARGET_TIME_SECONDS } from './rules.js';

export const LANDING_POINTS = { perfect: 20, poor: 5, fall: 0 };

export function skiJumpPoints(distance, landing) {
  if (!(landing in LANDING_POINTS)) throw new RangeError(`unknown landing: ${landing}`);
  if (landing === 'fall') return 0;
  const metres = Math.min(SKI_JUMP_MAX_DISTANCE, Math.floor(distance));
  const distancePoints = Math.max(0, 60 - 2 * (SKI_JUMP_MAX_DISTANCE - metres));
  return distancePoints + LANDING_POINTS[landing];
}

// Every started second over the target costs points; epsilon absorbs float noise.
export function overtimeSeconds(time) {
  return Math.max(0, Math.ceil(time - TARGET_TIME_SECONDS - 1e-9));
}

export function slalomPoints({ time, hits, missed }) {
  return Math.max(0, 60 - 3 * overtimeSeconds(time) - 10 * hits - 20 * missed);
}

export function lugePoints(time) {
  return Math.max(0, 60 - 5 * overtimeSeconds(time));
}

function isBetterAttempt(eventId, candidate, current) {
  if (eventId === 'luge') return candidate.time < current.time;
  if (candidate.points !== current.points) return candidate.points > current.points;
  if (eventId === 'skiJump') return candidate.distance > current.distance;
  return candidate.time < current.time;
}

export function bestAttempt(eventId, attempts) {
  const valid = attempts.filter((attempt) => attempt.valid);
  if (valid.length === 0) return null;
  return valid.reduce((best, attempt) => (isBetterAttempt(eventId, attempt, best) ? attempt : best));
}

export function eventResult(eventId, attempts) {
  const metricKey = METRIC_KEY[eventId];
  const best = bestAttempt(eventId, attempts);
  return best ? { points: best.points, [metricKey]: best[metricKey] } : { points: 0, [metricKey]: null };
}
