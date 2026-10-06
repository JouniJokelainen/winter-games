export const SFX = {
  select: (audio) => audio.tone({ wave: 'square', freq: 660, duration: 0.05, volume: 0.15 }),
  confirm: (audio) => {
    audio.tone({ wave: 'square', freq: 660, duration: 0.06, volume: 0.15 });
    audio.tone({ wave: 'square', freq: 990, duration: 0.08, volume: 0.15, delay: 0.06 });
  },
  back: (audio) => audio.tone({ wave: 'square', freq: 440, freqEnd: 220, duration: 0.1, volume: 0.15 }),
  jump: (audio) => audio.tone({ wave: 'square', freq: 300, freqEnd: 900, duration: 0.25, volume: 0.2 }),
  land: (audio) => audio.noise({ duration: 0.2, volume: 0.3, filterFreq: 1200 }),
  crash: (audio) => {
    audio.noise({ duration: 0.6, volume: 0.4, filterFreq: 600 });
    audio.tone({ wave: 'sawtooth', freq: 200, freqEnd: 50, duration: 0.5, volume: 0.2 });
  },
  hit: (audio) => audio.tone({ wave: 'square', freq: 180, freqEnd: 120, duration: 0.08, volume: 0.25 }),
  push: (audio) => audio.noise({ duration: 0.05, volume: 0.15, filterFreq: 3000 }),
  warning: (audio) => audio.noise({ duration: 0.3, volume: 0.25, filterFreq: 5000 }),
  finish: (audio) => [523, 659, 784, 1047].forEach((freq, index) => {
    audio.tone({ wave: 'square', freq, duration: 0.12, volume: 0.18, delay: index * 0.12 });
  }),
  fail: (audio) => [392, 330, 262].forEach((freq, index) => {
    audio.tone({ wave: 'triangle', freq, duration: 0.2, volume: 0.25, delay: index * 0.2 });
  }),
  tick: (audio) => audio.tone({ wave: 'square', freq: 1200, duration: 0.03, volume: 0.1 }),
};
