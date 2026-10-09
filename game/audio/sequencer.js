const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const LOOKAHEAD_SECONDS = 0.6;
const TIMER_MS = 100;
const PERCUSSION_SECONDS = 0.1;

export function noteToFreq(note) {
  const match = /^([A-G]#?)(\d)$/.exec(note);
  if (!match || !(match[1] in NOTE_INDEX)) throw new Error(`invalid note: ${note}`);
  const midi = (Number(match[2]) + 1) * 12 + NOTE_INDEX[match[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

export function parsePattern(pattern) {
  const tokens = pattern.trim().split(/\s+/);
  const notes = [];
  tokens.forEach((token, step) => {
    if (token === '.') return;
    if (token === '-') {
      const last = notes.at(-1);
      if (!last || last.step + last.length !== step) throw new Error(`hold without note at step ${step}`);
      last.length += 1;
      return;
    }
    notes.push({ step, length: 1, freq: noteToFreq(token) });
  });
  return { notes, length: tokens.length };
}

export class Sequencer {
  constructor(audio, song) {
    this.audio = audio;
    this.loop = song.loop !== false;
    this.finished = false;
    this.stepSeconds = 60 / song.bpm / song.stepsPerBeat;
    this.tracks = song.channels.map((channel) => ({ ...channel, ...parsePattern(channel.pattern) }));
    this.loopSteps = Math.max(...this.tracks.map((track) => track.length));
    this.output = null;
    this.timer = null;
    this.nextLoopTime = 0;
  }

  start() {
    const { ctx, music } = this.audio;
    this.output = ctx.createGain();
    this.output.connect(music);
    this.nextLoopTime = ctx.currentTime + 0.1;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), TIMER_MS);
  }

  // Schedules whole loops ahead of time; stop() disconnects the output so queued notes go silent.
  schedule() {
    const { ctx } = this.audio;
    if (this.nextLoopTime < ctx.currentTime) this.nextLoopTime = ctx.currentTime + 0.05;
    while (!this.finished && this.nextLoopTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      for (const track of this.tracks) {
        for (const note of track.notes) {
          const at = this.nextLoopTime + note.step * this.stepSeconds;
          if (track.wave === 'noise') {
            this.audio.noise({
              duration: Math.min(note.length * this.stepSeconds * 0.9, PERCUSSION_SECONDS),
              volume: track.volume,
              filterFreq: note.freq,
              at,
              destination: this.output,
            });
            continue;
          }
          this.audio.tone({
            wave: track.wave,
            freq: note.freq,
            duration: note.length * this.stepSeconds * 0.9,
            volume: track.volume,
            at,
            destination: this.output,
          });
        }
      }
      this.nextLoopTime += this.loopSteps * this.stepSeconds;
      if (!this.loop) this.finished = true;
    }
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.output?.disconnect();
    this.output = null;
  }
}
