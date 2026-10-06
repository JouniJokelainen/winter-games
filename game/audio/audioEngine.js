import { Sequencer } from './sequencer.js';
import { SFX } from './sfx.js';

const MASTER_VOLUME = 0.5;
const MUTE_KEY = 'winterGames.muted';

function readMuted(storage) {
  try {
    return storage?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function createNoiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class AudioEngine {
  constructor(storage = null) {
    this.storage = storage;
    this.muted = readMuted(storage);
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.wantedSong = null;
    this.sequencer = null;
  }

  // Browsers only allow audio after a user gesture; main.js calls this on every keydown.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = createNoiseBuffer(this.ctx);
    if (this.wantedSong) this.startSequencer(this.wantedSong);
  }

  toggleMuted() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    try {
      this.storage?.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Storage may be unavailable; mute still works for this session.
    }
  }

  tone({ wave = 'square', freq, freqEnd = freq, duration, volume = 0.2, delay = 0, at = null, destination = this.master }) {
    if (!this.ctx) return;
    const start = at ?? this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(freq, start);
    if (freqEnd !== freq) oscillator.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  noise({ duration, volume = 0.2, delay = 0, filterFreq = 2000, destination = this.master }) {
    if (!this.ctx) return;
    const start = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(gain).connect(destination);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  playSfx(name) {
    SFX[name]?.(this);
  }

  playSong(song) {
    if (this.wantedSong === song) return;
    this.wantedSong = song;
    if (this.ctx) this.startSequencer(song);
  }

  stopSong() {
    this.wantedSong = null;
    this.sequencer?.stop();
    this.sequencer = null;
  }

  startSequencer(song) {
    this.sequencer?.stop();
    this.sequencer = new Sequencer(this, song);
    this.sequencer.start();
  }
}
