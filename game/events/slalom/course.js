export const COURSE_CENTER_X = 160;

const FIRST_POLE_Y = 140;
const FINISH_STRAIGHT = 210;

// Rhythm: warm-up, tight fast middle, offset turns that punish speed, steady finish. 23 poles; the
// sideways offsets are kept small so the bots' target times (about 30 s excellent, 33-36 s average) hold.
const SECTIONS = [
  { count: 6, spacing: 200, offset: 20, shifts: [0] },
  { count: 8, spacing: 150, offset: 16, shifts: [0] },
  { count: 4, spacing: 215, offset: 23, shifts: [-23, -23, 23, 23] },
  { count: 5, spacing: 190, offset: 19, shifts: [0] },
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
