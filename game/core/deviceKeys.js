// Nickname ownership on the shared board: each nickname is claimed by a secret code that the first device
// saving under it generates. The device keeps the code, the server keeps only its hash, and the code doubles
// as the recovery code for moving the nickname to another device.

// No I, O, 0 or 1, so a code that is read aloud or copied by hand cannot be mixed up.
export const SECRET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SECRET_LENGTH = 16;
export const KEYS_STORAGE_KEY = 'winterGames.deviceKeys';

function randomBytes(count) {
  return globalThis.crypto.getRandomValues(new Uint8Array(count));
}

// 256 is a multiple of the alphabet size, so the modulo keeps every character equally likely.
export function generateSecret(bytes = randomBytes) {
  return [...bytes(SECRET_LENGTH)].map((byte) => SECRET_ALPHABET[byte % SECRET_ALPHABET.length]).join('');
}

export function formatSecret(secret) {
  return secret.match(/.{1,4}/g).join('-');
}

// Typed or pasted codes: upper case, with dashes and spaces dropped.
export function normalizeSecret(raw) {
  return [...String(raw ?? '').toUpperCase()].filter((char) => SECRET_ALPHABET.includes(char)).join('');
}

export function isValidSecret(secret) {
  return typeof secret === 'string' && secret.length === SECRET_LENGTH && [...secret].every((char) => SECRET_ALPHABET.includes(char));
}

// Collects a recovery code one typed character at a time; characters outside the alphabet are ignored.
export class SecretEntry {
  constructor() {
    this.value = '';
  }

  append(char) {
    const normalized = normalizeSecret(char);
    if (normalized.length !== 1 || this.value.length >= SECRET_LENGTH) return false;
    this.value += normalized;
    return true;
  }

  backspace() {
    this.value = this.value.slice(0, -1);
  }

  get isComplete() {
    return this.value.length === SECRET_LENGTH;
  }

  get display() {
    return formatSecret(this.value.padEnd(SECRET_LENGTH, '_'));
  }
}

// The codes this device holds, by nickname, in localStorage (in memory when storage is unavailable).
export class DeviceKeys {
  constructor(storage = null, bytes = randomBytes) {
    this.storage = storage;
    this.bytes = bytes;
    this.memory = {};
  }

  read() {
    if (!this.storage) return this.memory;
    try {
      const saved = JSON.parse(this.storage.getItem(KEYS_STORAGE_KEY) ?? '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch {
      return this.memory;
    }
  }

  write(keys) {
    this.memory = keys;
    try {
      this.storage?.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys));
    } catch {
      // Storage blocked or full: the codes stay in memory for this session.
    }
  }

  get(nickname) {
    const secret = this.read()[nickname];
    return isValidSecret(secret) ? secret : null;
  }

  set(nickname, secret) {
    this.write({ ...this.read(), [nickname]: secret });
  }

  remove(nickname) {
    const { [nickname]: removed, ...rest } = this.read();
    this.write(rest);
    return removed;
  }

  // The code for a nickname, generating and storing a new one when this device has none yet.
  getOrCreate(nickname) {
    const existing = this.get(nickname);
    if (existing) return { secret: existing, created: false };
    const secret = generateSecret(this.bytes);
    this.set(nickname, secret);
    return { secret, created: true };
  }
}
