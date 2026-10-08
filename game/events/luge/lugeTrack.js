// Prototype luge track. Curvature is in 1/m along the distance s (positive = right turn); every turn is a
// trapezoid: the curvature ramps in, holds, and ramps out.
export const RED_LINE_S = 22;
export const FINISH_S = 1060;

export const TURNS = [
  { at: 90, length: 80, k: 0.010 },
  { at: 200, length: 70, k: -0.012 },
  { at: 300, length: 60, k: 0.018 },
  { at: 390, length: 60, k: -0.020 },
  { at: 480, length: 40, k: 0.022 },
  { at: 540, length: 40, k: -0.022 },
  { at: 640, length: 70, k: 0.045 },
  { at: 760, length: 60, k: -0.025 },
  { at: 850, length: 50, k: 0.030 },
  { at: 930, length: 50, k: -0.030 },
];

function weight(s, turn) {
  const a = s - turn.at;
  if (a < 0 || a > turn.length) return 0;
  const ramp = Math.min(20, turn.length / 3);
  return Math.min(1, a / ramp, (turn.length - a) / ramp);
}

export function curvatureAt(s) {
  let k = 0;
  for (const turn of TURNS) k += turn.k * weight(s, turn);
  return k;
}

// Heading (radians) accumulated along the track, used to slide the distant backdrop sideways.
const HEADING_STEP = 1;
const HEADINGS = (() => {
  const table = [0];
  for (let s = 0; s < FINISH_S + 200; s += HEADING_STEP) table.push(table.at(-1) + curvatureAt(s) * HEADING_STEP);
  return table;
})();

export function headingAt(s) {
  const f = Math.max(0, Math.min(HEADINGS.length - 2, s / HEADING_STEP));
  const i = Math.floor(f);
  return HEADINGS[i] + (HEADINGS[i + 1] - HEADINGS[i]) * (f - i);
}

// Number (1..TURNS.length) of the turn being driven at s, or of the next one; the last number after the final turn.
export function turnNumber(s) {
  const index = TURNS.findIndex((turn) => s < turn.at + turn.length);
  return index === -1 ? TURNS.length : index + 1;
}
