import {
  EVENT_IDS, isValidNickname, MAX_POINTS, METRIC_KEY, normalizeNickname, SKI_JUMP_MAX_DISTANCE,
} from './rules.js';

export const RECENT_LIMIT = 20;
export const TOP_LIMIT = 10;

export function emptyBoard() {
  return { version: 1, users: {}, recent: [], top: [], eventRecords: {} };
}

function fail(error) {
  return { ok: false, error };
}

function isValidMetric(eventId, value) {
  if (value === null) return true;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false;
  return eventId !== 'skiJump' || value <= SKI_JUMP_MAX_DISTANCE;
}

export function validateResult(payload) {
  if (!payload || typeof payload !== 'object') return fail('payload must be an object');
  const nickname = normalizeNickname(payload.nickname);
  if (!isValidNickname(nickname)) return fail('invalid nickname');
  if (!payload.events || typeof payload.events !== 'object') return fail('events missing');

  const events = {};
  for (const eventId of EVENT_IDS) {
    const event = payload.events[eventId];
    if (!event || !Number.isInteger(event.points) || event.points < 0 || event.points > MAX_POINTS[eventId]) {
      return fail(`invalid points for ${eventId}`);
    }
    const metricKey = METRIC_KEY[eventId];
    const metric = event[metricKey] ?? null;
    if (!isValidMetric(eventId, metric)) return fail(`invalid ${metricKey} for ${eventId}`);
    events[eventId] = { points: event.points, [metricKey]: metric };
  }
  return { ok: true, value: { nickname, events } };
}

export function isBetterRecord(eventId, candidate, current) {
  if (!current) return true;
  if (candidate.points !== current.points) return candidate.points > current.points;
  const metricKey = METRIC_KEY[eventId];
  return eventId === 'skiJump'
    ? candidate[metricKey] > current[metricKey]
    : candidate[metricKey] < current[metricKey];
}

export function topTotals(users, limit = TOP_LIMIT) {
  return Object.entries(users)
    .map(([nickname, user]) => ({ nickname, total: user.bestTotal }))
    .sort((a, b) => b.total - a.total || a.nickname.localeCompare(b.nickname, 'fi'))
    .slice(0, limit);
}

export function eventRecords(users) {
  const best = {};
  for (const eventId of EVENT_IDS) {
    for (const [nickname, user] of Object.entries(users)) {
      const record = user.records[eventId];
      if (record && isBetterRecord(eventId, record, best[eventId])) best[eventId] = { nickname, ...record };
    }
  }
  return best;
}

export function applyResult(board, result, date) {
  const total = EVENT_IDS.reduce((sum, eventId) => sum + result.events[eventId].points, 0);
  const previous = board.users[result.nickname] ?? { bestTotal: 0, competitions: 0, records: {} };

  const records = { ...previous.records };
  for (const eventId of EVENT_IDS) {
    const candidate = result.events[eventId];
    if (candidate[METRIC_KEY[eventId]] !== null && isBetterRecord(eventId, candidate, records[eventId])) {
      records[eventId] = { ...candidate, date };
    }
  }

  const users = {
    ...board.users,
    [result.nickname]: {
      bestTotal: Math.max(previous.bestTotal, total),
      competitions: previous.competitions + 1,
      records,
    },
  };
  const recent = [{ nickname: result.nickname, date, total, events: result.events }, ...board.recent]
    .slice(0, RECENT_LIMIT);

  return { version: 1, users, recent, top: topTotals(users), eventRecords: eventRecords(users) };
}
