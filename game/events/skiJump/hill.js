const DEG = Math.PI / 180;

export const INRUN_ANGLE = 35 * DEG;
export const INRUN_LENGTH = 53;
export const LIP_ANGLE = -11 * DEG;
export const TRANSITION_RADIUS = 40;

const PATH_STEP = 0.25;

// The inrun is a straight 35° ramp that curves (radius TRANSITION_RADIUS) into the 11° takeoff table.
// Built as a polyline from the start and shifted so that it ends exactly at the lip (0, 0).
function buildInrunPath() {
  const turn = INRUN_ANGLE - -LIP_ANGLE;
  const arcLength = TRANSITION_RADIUS * turn;
  const straightLength = INRUN_LENGTH - arcLength;
  const points = [{ s: 0, x: 0, y: 0, angle: -INRUN_ANGLE }];
  for (let s = PATH_STEP; s <= INRUN_LENGTH + 1e-9; s += PATH_STEP) {
    const descent = s <= straightLength ? INRUN_ANGLE : INRUN_ANGLE - (s - straightLength) / TRANSITION_RADIUS;
    const previous = points.at(-1);
    points.push({
      s,
      x: previous.x + Math.cos(descent) * PATH_STEP,
      y: previous.y - Math.sin(descent) * PATH_STEP,
      angle: -descent,
    });
  }
  const end = points.at(-1);
  return points.map((point) => ({ ...point, x: point.x - end.x, y: point.y - end.y }));
}

const INRUN_PATH = buildInrunPath();

// Metres; x grows downhill to the right, y grows upward; the lip is at (0, 0).
// The landing hill flattens after ~190 m, so even the longest jumps stay near 200 m.
export const HILL = {
  inrunAngle: INRUN_ANGLE,
  inrunLength: INRUN_LENGTH,
  lipAngle: LIP_ANGLE,
  inrunPath: INRUN_PATH,
  inrunStart: { x: INRUN_PATH[0].x, y: INRUN_PATH[0].y },
  landing: [[0, 0], [5, -3], [40, -18], [100, -55], [170, -100], [190, -111], [205, -115], [220, -117], [400, -118]],
  kPoint: 170,
  hillSize: 200,
  outrunEnd: 400,
};

export function hillHeightAt(hill, x) {
  const points = hill.landing;
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points.at(-1)[1];
}

// Point on the inrun `distance` metres from the start: { x, y, angle } (angle negative = descending).
export function inrunPointAt(hill, distance) {
  const path = hill.inrunPath;
  const clamped = Math.min(hill.inrunLength, Math.max(0, distance));
  const index = Math.min(path.length - 2, Math.floor(clamped / PATH_STEP));
  const a = path[index];
  const b = path[index + 1];
  const t = Math.min(1, (clamped - a.s) / (b.s - a.s));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: a.angle + (b.angle - a.angle) * t };
}

// Height of the inrun surface at horizontal position x (between the start and the lip).
export function inrunHeightAt(hill, x) {
  const path = hill.inrunPath;
  if (x <= path[0].x) return path[0].y;
  for (let i = 1; i < path.length; i++) {
    if (x <= path[i].x) {
      const a = path[i - 1];
      const b = path[i];
      return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    }
  }
  return path.at(-1).y;
}
