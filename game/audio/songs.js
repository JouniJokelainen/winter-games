const TITLE_LEAD = [
  'E5 - . E5 G5 - E5 . D5 - C5 - D5 - - .',
  'E5 - . E5 G5 - A5 . G5 - E5 - D5 - - .',
  'C5 - . C5 E5 - G5 . A5 - G5 - E5 - - .',
  'D5 - E5 - D5 - B4 - C5 - - - . . . .',
];
const TITLE_BASS = [
  'C3 . C3 . G2 . G2 . A2 . A2 . G2 . G2 .',
  'C3 . C3 . E3 . E3 . F3 . F3 . G3 . G3 .',
  'A2 . A2 . E3 . E3 . F3 . F3 . C3 . C3 .',
  'G2 . G2 . G2 . G2 . C3 . G2 . C3 . . .',
];

const EVENT_LEAD = [
  'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .',
  'F5 . D5 . A4 . D5 . E5 - - . B4 . E5 .',
];
const EVENT_BASS = [
  'A2 . A2 A3 A2 . A2 A3 A2 . A2 A3 A2 . A2 A3',
  'D3 . D3 D2 D3 . D3 D2 E2 . E2 E3 E2 . E2 E3',
];

export const TITLE_THEME = {
  bpm: 132,
  stepsPerBeat: 4,
  channels: [
    { wave: 'square', volume: 0.07, pattern: TITLE_LEAD.join(' ') },
    { wave: 'triangle', volume: 0.14, pattern: TITLE_BASS.join(' ') },
  ],
};

export const EVENT_THEME = {
  bpm: 150,
  stepsPerBeat: 4,
  channels: [
    { wave: 'square', volume: 0.05, pattern: EVENT_LEAD.join(' ') },
    { wave: 'triangle', volume: 0.12, pattern: EVENT_BASS.join(' ') },
  ],
};
