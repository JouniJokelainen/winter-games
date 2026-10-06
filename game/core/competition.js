import { ATTEMPTS_PER_EVENT, EVENT_IDS } from './rules.js';
import { eventResult } from './scoring.js';

export class Competition {
  constructor(nickname, eventIds = EVENT_IDS) {
    this.nickname = nickname;
    this.eventIds = eventIds;
    this.eventIndex = 0;
    this.attempts = Object.fromEntries(eventIds.map((eventId) => [eventId, []]));
  }

  get currentEventId() {
    return this.eventIds[this.eventIndex] ?? null;
  }

  get attemptNumber() {
    return this.attempts[this.currentEventId].length + 1;
  }

  get isFinished() {
    return this.eventIndex >= this.eventIds.length;
  }

  get total() {
    return this.eventIds.reduce((sum, eventId) => sum + this.eventResult(eventId).points, 0);
  }

  isEventComplete() {
    return this.attempts[this.currentEventId].length >= ATTEMPTS_PER_EVENT;
  }

  recordAttempt(attempt) {
    if (this.isEventComplete()) throw new Error('event already complete');
    this.attempts[this.currentEventId].push(attempt);
  }

  advance() {
    this.eventIndex += 1;
  }

  eventResult(eventId) {
    return eventResult(eventId, this.attempts[eventId]);
  }

  toPayload() {
    return {
      nickname: this.nickname,
      events: Object.fromEntries(this.eventIds.map((eventId) => [eventId, this.eventResult(eventId)])),
    };
  }
}
