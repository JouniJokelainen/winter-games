export const COURSE_CENTER_X = 160;

const FIRST_POLE_Y = 300;
const FINISH_STRAIGHT = 320;

// Rhythm: wide warm-up, tight fast middle, offset turns that punish speed, steady finish.
const SECTIONS = [
  { count: 5, spacing: 230, offset: 26, shifts: [0] },
  { count: 7, spacing: 170, offset: 20, shifts: [0] },
  { count: 4, spacing: 230, offset: 30, shifts: [-30, -30, 30, 30] },
  { count: 4, spacing: 210, offset: 24, shifts: [0] },
];

function buildPoles() {
  const poles = [];
  let y = FIRST_POLE_Y;
  for (const section of SECTIONS) {
    for (let i = 0; i < section.count; i++) {
      const side = poles.length % 2 === 0 ? 'left' : 'right';
      const shift = section.shifts[i % section.shifts.length];
      const x = COURSE_CENTER_X + shift + (side === 'left' ? -section.offset : section.offset);
      if (poles.length > 0) y += section.spacing;
      poles.push({ x, y, side, color: side === 'left' ? 'red' : 'blue' });
    }
  }
  return poles;
}

const POLES = buildPoles();

export const COURSE = {
  startX: COURSE_CENTER_X,
  startY: 0,
  fenceLeftX: 60,
  fenceRightX: 260,
  poles: POLES,
  finishY: POLES.at(-1).y + FINISH_STRAIGHT,
};
