import { isValidNickname, NICKNAME_CHARS, NICKNAME_MAX_LENGTH, normalizeNickname } from './rules.js';

export class NicknameEntry {
  constructor() {
    this.value = '';
  }

  append(char) {
    const normalized = normalizeNickname(char);
    if (normalized.length !== 1 || !NICKNAME_CHARS.includes(normalized)) return false;
    if (this.value.length >= NICKNAME_MAX_LENGTH) return false;
    this.value += normalized;
    return true;
  }

  backspace() {
    this.value = this.value.slice(0, -1);
  }

  get isValid() {
    return isValidNickname(this.value);
  }
}
