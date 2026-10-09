// Title: a slow, triumphant anthem in D major. Eight bars (D A Bm G D A G A) with a stepwise rising lead,
// a harmony a third below, a soft sawtooth pad and a steady bass.
const hold = (note) => [note, ...Array(15).fill('-')].join(' ');
const pulse = (note) => `${note} . . . ${note} . . . ${note} . . . ${note} . . .`;

const TITLE_LEAD = [
  'F#5 - - - - - - - A5 - - - F#5 - E5 -',
  'E5 - - - - - - - A5 - - - - - - -',
  'D5 - - - F#5 - - - B5 - - - A5 - F#5 -',
  'G5 - - - - - - - F#5 - - - E5 - D5 -',
  'F#5 - - - A5 - - - D6 - - - - - - -',
  'C#6 - - - B5 - A5 - E5 - - - A5 - - -',
  'B5 - - - A5 - G5 - F#5 - - - D5 - - -',
  'E5 - - - - - - - E5 - F#5 - E5 - - .',
];
const TITLE_HARMONY = [
  'D5 - - - - - - - F#5 - - - D5 - C#5 -',
  'C#5 - - - - - - - E5 - - - - - - -',
  'B4 - - - D5 - - - F#5 - - - E5 - D5 -',
  'D5 - - - - - - - D5 - - - C#5 - B4 -',
  'D5 - - - F#5 - - - A5 - - - - - - -',
  'E5 - - - D5 - C#5 - C#5 - - - E5 - - -',
  'G5 - - - E5 - D5 - D5 - - - B4 - - -',
  'C#5 - - - - - - - C#5 - D5 - C#5 - - .',
];
const TITLE_PAD = ['F#4', 'C#4', 'D4', 'B3', 'F#4', 'C#4', 'B3', 'C#4'].map(hold);
const TITLE_BASS = ['D2', 'A2', 'B2', 'G2', 'D2', 'A2', 'G2', 'A2'].map(pulse);

// Percussion channels use the note as the cutoff of filtered noise: low = kick, G6 = snare, C7 = hat.
const KICK = 'C3';
const SNARE = 'G6';
const HAT = 'C7';

// Ski jump: a fast, rising arpeggio over a pulsing bass and drums that build into a snare roll,
// ending on the dominant (E) so the loop keeps the tension (A minor).
const SKI_JUMP_LEAD = [
  'A4 C5 E5 A5 E5 C5 E5 A5 A4 C5 E5 A5 E5 C5 E5 A5',
  'G4 B4 D5 G5 D5 B4 D5 G5 F4 A4 C5 F5 C5 A4 C5 F5',
  'A4 C5 E5 A5 E5 C5 E5 A5 C5 E5 G5 C6 G5 E5 G5 C6',
  'B4 D5 F5 B5 F5 D5 F5 B5 E5 G#5 B5 E6 B5 G#5 B5 E6',
];
const SKI_JUMP_BASS = [
  'A2 . A2 . A2 . A2 . A2 . A2 . A2 . A2 .',
  'G2 . G2 . G2 . G2 . F2 . F2 . F2 . F2 .',
  'A2 . A2 . A2 . A2 . C3 . C3 . C3 . C3 .',
  'B2 . B2 . B2 . B2 . E2 . E2 . E2 . E2 .',
];
const SKI_JUMP_DRUMS = [
  `${KICK} . ${HAT} . ${SNARE} . ${HAT} . ${KICK} . ${HAT} . ${SNARE} . ${HAT} .`,
  `${KICK} . ${HAT} . ${SNARE} . ${HAT} . ${KICK} . ${HAT} . ${SNARE} . ${HAT} .`,
  `${KICK} . ${HAT} . ${SNARE} . ${HAT} . ${KICK} . ${HAT} . ${SNARE} . ${HAT} .`,
  `${KICK} . ${SNARE} . ${KICK} . ${SNARE} . ${SNARE} ${SNARE} ${SNARE} ${SNARE} ${SNARE} ${SNARE} ${SNARE} ${SNARE}`,
];

// Slalom: quick and zigzagging, the lead swings between high and low like the poles (E minor).
const SLALOM_LEAD = [
  'E5 . B4 . E5 . B4 . G5 . D5 . G5 . D5 .',
  'A5 . E5 . A5 . E5 . F#5 . D5 . F#5 . D5 .',
  'G5 . D5 . G5 . D5 . B5 . G5 . B5 . G5 .',
  'A5 . F#5 . D5 . B4 . E5 - . . B4 . E5 .',
];
const SLALOM_BASS = [
  'E2 . E3 . E2 . E3 . G2 . G3 . G2 . G3 .',
  'A2 . A3 . A2 . A3 . D2 . D3 . D2 . D3 .',
  'G2 . G3 . G2 . G3 . E2 . E3 . E2 . E3 .',
  'A2 . A3 . B2 . B3 . E2 . E3 . E2 . E3 .',
];
const SLALOM_DRUMS = `${KICK} . ${HAT} . ${SNARE} . ${HAT} . ${KICK} . ${HAT} . ${SNARE} . ${HAT} .`;

// Luge: heavy and driving, a sawtooth riff over a pounding bass (D minor).
const LUGE_LEAD = [
  'D4 . D4 . F4 . D4 . A4 - . G4 . F4 - .',
  'D4 . D4 . F4 . D4 . C5 - . A4 . G4 - .',
  'E4 . E4 . G4 . E4 . B4 - . A4 . G4 - .',
  'F4 . A4 . C5 . A4 . D5 - - - . . . .',
];
const LUGE_BASS = [
  'D2 . D2 . D2 . D2 . D2 . D2 . D2 . D2 .',
  'D2 . D2 . D2 . D2 . C2 . C2 . C2 . C2 .',
  'E2 . E2 . E2 . E2 . G2 . G2 . G2 . G2 .',
  'F2 . F2 . F2 . F2 . A2 . A2 . D2 . D2 .',
];
const LUGE_DRUMS = `${KICK} . . . ${SNARE} . . . ${KICK} . . ${KICK} ${SNARE} . . .`;

const FINALE_LEAD = 'C5 . C5 . C5 - E5 - G5 - - - C6 - - -';
const FINALE_BASS = 'C3 - - - C3 - - - G3 - - - C3 - - -';

export const TITLE_THEME = {
  bpm: 84,
  stepsPerBeat: 4,
  channels: [
    { wave: 'square', volume: 0.05, pattern: TITLE_LEAD.join(' ') },
    { wave: 'triangle', volume: 0.06, pattern: TITLE_HARMONY.join(' ') },
    { wave: 'sawtooth', volume: 0.025, pattern: TITLE_PAD.join(' ') },
    { wave: 'triangle', volume: 0.14, pattern: TITLE_BASS.join(' ') },
  ],
};

export const SKI_JUMP_THEME = {
  bpm: 140,
  stepsPerBeat: 4,
  channels: [
    { wave: 'square', volume: 0.045, pattern: SKI_JUMP_LEAD.join(' ') },
    { wave: 'triangle', volume: 0.13, pattern: SKI_JUMP_BASS.join(' ') },
    { wave: 'noise', volume: 0.07, pattern: SKI_JUMP_DRUMS.join(' ') },
  ],
};

export const SLALOM_THEME = {
  bpm: 168,
  stepsPerBeat: 4,
  channels: [
    { wave: 'square', volume: 0.05, pattern: SLALOM_LEAD.join(' ') },
    { wave: 'triangle', volume: 0.12, pattern: SLALOM_BASS.join(' ') },
    { wave: 'noise', volume: 0.08, pattern: Array(4).fill(SLALOM_DRUMS).join(' ') },
  ],
};

export const LUGE_THEME = {
  bpm: 112,
  stepsPerBeat: 4,
  channels: [
    { wave: 'sawtooth', volume: 0.035, pattern: LUGE_LEAD.join(' ') },
    { wave: 'triangle', volume: 0.14, pattern: LUGE_BASS.join(' ') },
    { wave: 'noise', volume: 0.1, pattern: Array(4).fill(LUGE_DRUMS).join(' ') },
  ],
};

// Plays once on the results screen.
export const FINALE_THEME = {
  bpm: 120,
  stepsPerBeat: 4,
  loop: false,
  channels: [
    { wave: 'square', volume: 0.07, pattern: FINALE_LEAD },
    { wave: 'triangle', volume: 0.14, pattern: FINALE_BASS },
  ],
};
