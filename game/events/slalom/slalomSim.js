// Units: pixels and seconds. y grows downhill; angle 0 is straight down, positive angle moves right.
export const SLALOM_CONFIG = {
  startSpeed: 40,
  gravity: 60,
  drag: 60 / (130 * 130), // gravity-only speed settles at 130 px/s
  pushImpulse: 12,
  maxSpeed: 220,
  maxAngle: Math.PI / 3,
  turnRate: 3.0,
  turnSpeedPenalty: 0.5, // turn rate at max speed = turnRate * (1 - penalty)
  returnRate: 2.0,
  turnDrag: 0.8,
  hitRadius: 4,
  hitSpeedFactor: 0.6,
  maxMissed: 2,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createSlalomState(course) {
  return {
    course,
    phase: 'ready',
    x: course.startX,
    y: course.startY,
    angle: 0,
    speed: 0,
    time: 0,
    hits: 0,
    missed: 0,
    poles: course.poles.map(() => ({ hit: false, result: null })),
    nextPole: 0,
    reason: null,
    events: [],
  };
}

function disqualify(state, reason) {
  state.phase = 'disqualified';
  state.reason = reason;
  state.events.push({ type: 'disqualified', reason });
}

function steer(state, controls, dt) {
  const C = SLALOM_CONFIG;
  const direction = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
  if (direction !== 0) {
    const rate = C.turnRate * (1 - (C.turnSpeedPenalty * state.speed) / C.maxSpeed);
    state.angle = clamp(state.angle + direction * rate * dt, -C.maxAngle, C.maxAngle);
  } else {
    state.angle -= Math.sign(state.angle) * Math.min(Math.abs(state.angle), C.returnRate * dt);
  }
}

function move(state, controls, dt) {
  const C = SLALOM_CONFIG;
  const accel = C.gravity
    - C.drag * state.speed * state.speed
    - C.turnDrag * Math.abs(Math.sin(state.angle)) * state.speed;
  state.speed = clamp(state.speed + accel * dt + controls.pushes * C.pushImpulse, 0, C.maxSpeed);
  state.x += Math.sin(state.angle) * state.speed * dt;
  state.y += Math.cos(state.angle) * state.speed * dt;
  state.time += dt;
}

function checkHits(state) {
  const C = SLALOM_CONFIG;
  state.course.poles.forEach((pole, index) => {
    const status = state.poles[index];
    if (!status.hit && Math.hypot(state.x - pole.x, state.y - pole.y) < C.hitRadius) {
      status.hit = true;
      state.hits += 1;
      state.speed *= C.hitSpeedFactor;
      state.events.push({ type: 'hit', pole: index });
    }
  });
}

function checkPassedPoles(state) {
  const { poles } = state.course;
  while (state.nextPole < poles.length && state.y >= poles[state.nextPole].y) {
    const index = state.nextPole;
    state.nextPole += 1;
    const pole = poles[index];
    const correctSide = pole.side === 'left' ? state.x < pole.x : state.x > pole.x;
    state.poles[index].result = correctSide ? 'passed' : 'missed';
    state.events.push({ type: correctSide ? 'passed' : 'missed', pole: index });
    if (!correctSide) {
      state.missed += 1;
      if (state.missed >= SLALOM_CONFIG.maxMissed) {
        disqualify(state, 'missedPoles');
        return;
      }
    }
  }
}

function checkFinish(state) {
  const { course } = state;
  if (state.x <= course.fenceLeftX || state.x >= course.fenceRightX) {
    disqualify(state, 'outOfBounds');
    return;
  }
  if (state.y >= course.finishY) {
    const downhillSpeed = Math.cos(state.angle) * state.speed;
    if (downhillSpeed > 0) state.time -= (state.y - course.finishY) / downhillSpeed;
    state.phase = 'finished';
    state.events.push({ type: 'finish' });
  }
}

export function stepSlalom(state, controls, dt) {
  state.events = [];
  if (state.phase === 'ready') {
    if (controls.pushes > 0) {
      state.phase = 'running';
      state.speed = SLALOM_CONFIG.startSpeed;
      state.events.push({ type: 'start' });
    }
    return state;
  }
  if (state.phase !== 'running') return state;

  steer(state, controls, dt);
  move(state, controls, dt);
  checkHits(state);
  checkPassedPoles(state);
  if (state.phase === 'running') checkFinish(state);
  return state;
}
