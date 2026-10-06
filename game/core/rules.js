export const EVENT_IDS = ['skiJump', 'slalom', 'luge'];
export const MAX_POINTS = { skiJump: 80, slalom: 60, luge: 60 };
export const METRIC_KEY = { skiJump: 'distance', slalom: 'time', luge: 'time' };
export const ATTEMPTS_PER_EVENT = 3;
export const SKI_JUMP_MAX_DISTANCE = 200;
export const TARGET_TIME_SECONDS = 30;
export const NICKNAME_MAX_LENGTH = 10;
export const NICKNAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÅ0123456789';

export function normalizeNickname(raw) {
  return String(raw ?? '').trim().toUpperCase();
}

export function isValidNickname(nickname) {
  return typeof nickname === 'string'
    && nickname.length >= 1
    && nickname.length <= NICKNAME_MAX_LENGTH
    && [...nickname].every((char) => NICKNAME_CHARS.includes(char));
}
