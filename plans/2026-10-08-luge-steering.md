# Luge: make steering necessary – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playtest showed the luge can be finished by braking alone with the sled staying in the middle. Make steering and the outer line necessary, and make braking alone fail.

**Architecture:** Three rule changes in `lugeSim.js` (centrifugal drift, position-dependent safe speed, 45 s time limit), plus a matching bot, tests and label. Values were tuned with a prototype on the real track (`.superpowers/proto/`, git-ignored).

**Tech Stack:** Plain ES modules, `node --test`. No new packages.

## Global Constraints

- Code, identifiers and comments in English; on-screen texts Finnish upper case.
- No new packages. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Product rules unchanged: crash = rejected run (`valid: false`, 0 points); 30 s = 60 points, −5 per started second; 3 attempts, fastest valid run counts.
- Work in `.worktrees/luge` (branch `feature/luge`).

## Rules added (design delta)

1. **Drift:** in a turn (`|k| > kSafeMin`) the sled slides toward the outer wall: `lateral -= driftGain · v² · k · dt` (a right turn, k > 0, pushes the sled left). The player must steer inward. The automatic return to the centre exists only on straights (`straightReturn`, only while no arrow is held); in a turn the sled stays where the player puts it.
2. **Safe speed depends on position:** `vSafe(k, lateral) = √(safeA / |k|) · (1 + outerSafe · outer)` with `outer = −lateral · sign(k)` (−1 inner … +1 outer). The outer line allows more speed, the inner line less.
3. **Time limit:** a run that is still going at `timeLimit` = 45 s is a rejected run (`crashed`, reason `'time'`, text `AIKA YLITTYI`). Holding the brake therefore cannot finish a run; 45 s is already worth 0 points under the 30 s rule.

Measured on the real track with the bots in this plan: good line 29.38 s, centre line 31.81 s, average 34.48 s; no input crashes (speed) at 12.97 s; braking above any speed from 20 to 48 m/s without steering always crashes (wall, speed or time); always braking times out at 45 s.

---

### Task 1: Drift, position-dependent safe speed and time limit

**Files:**
- Modify: `game/events/luge/lugeSim.js` (replace whole file with the code below)
- Modify: `tests/helpers/lugeBot.js`
- Modify: `tests/events/luge/lugeSim.test.js`, `tests/events/luge/bot.test.js`, `tests/events/luge/lugeScene.test.js`
- Modify: `game/events/luge/lugeScene.js` (crash label)
- Modify: `plans/2026-10-08-luge-design.md`

**Interfaces:**
- Produces (changed): `vSafe(k, lateral = 0)`; `speedLimitAhead(s, distance, outer = 0)` where `outer` is the assumed outer-side position (−1…1) in every turn ahead (0 = centre line, used by the HUD limit marker and the warning); `stepLuge` may now crash with `state.reason === 'time'`. New exports: `vSafeOuter(k, outer)`. `LUGE_CONFIG` gains `driftGain`, `straightReturn`, `outerSafe`, `timeLimit`, loses `lateralReturn`.

- [ ] **Step 1: Replace `game/events/luge/lugeSim.js`**

```js
import { curvatureAt, FINISH_S, RED_LINE_S } from './lugeTrack.js';

// Distances in metres, speeds in m/s. Tuned with the bot test (tests/events/luge/bot.test.js).
export const LUGE_CONFIG = {
  pushImpulse: 0.3, // speed added per Space press while pushing
  pushDecay: 0.8, // speed lost per second while pushing
  pushMin: 1, // the runner never stops walking
  pushMax: 4,
  gravity: 9.3,
  drag: 0.0022,
  brake: 15,
  lateralRate: 2.6, // lateral units per second while an arrow is held
  straightReturn: 0.4, // lateral units per second back to the centre on a straight with no arrow held
  driftGain: 0.025, // outward slide in a turn: lateral units per second = driftGain · v² · |k|
  turnGain: 8, // speed change (m/s²) at kMax with the sled fully on the outer (+) or inner (-) side
  kMax: 0.045,
  safeA: 48, // vSafe(k) = sqrt(safeA / |k|) on the centre line
  outerSafe: 0.4, // the safe speed grows by this share on the outer side and shrinks on the inner side
  kSafeMin: 0.004, // gentler curves have no speed limit and no drift
  lookStep: 5,
  timeLimit: 45, // a run still going after this many seconds is rejected
};

// +1 = fully on the outer side of the turn, -1 = fully on the inner side. A right turn (k > 0) has its outer side on the left.
function outerSide(k, lateral) {
  return -lateral * Math.sign(k);
}

export function vSafeOuter(k, outer) {
  return Math.sqrt(LUGE_CONFIG.safeA / Math.abs(k)) * (1 + LUGE_CONFIG.outerSafe * outer);
}

export function vSafe(k, lateral = 0) {
  return vSafeOuter(k, outerSide(k, lateral));
}

// Lowest safe speed over the next `distance` metres of track, assuming the sled is at `outer` (-1..1) in every
// turn; Infinity when no turn is in range.
export function speedLimitAhead(s, distance, outer = 0) {
  let limit = Infinity;
  for (let d = 0; d <= distance; d += LUGE_CONFIG.lookStep) {
    const k = curvatureAt(s + d);
    if (Math.abs(k) > LUGE_CONFIG.kSafeMin) limit = Math.min(limit, vSafeOuter(k, outer));
  }
  return limit;
}

export function createLugeState() {
  return { phase: 'ready', s: 0, v: 0, lateral: 0, time: 0, reason: null, events: [] };
}

function stepPush(state, controls, dt) {
  const c = LUGE_CONFIG;
  state.time += dt;
  state.v = Math.min(c.pushMax, Math.max(c.pushMin, state.v + controls.pushes * c.pushImpulse - c.pushDecay * dt));
  state.s += state.v * dt;
  if (state.s >= RED_LINE_S) {
    state.phase = 'running';
    state.events.push({ type: 'hop' });
  }
}

function crash(state, reason) {
  state.phase = 'crashed';
  state.reason = reason;
  state.events.push({ type: 'crash' });
}

function steer(state, controls, k, dt) {
  const c = LUGE_CONFIG;
  const direction = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
  state.lateral += direction * c.lateralRate * dt;
  if (Math.abs(k) > c.kSafeMin) {
    state.lateral -= c.driftGain * state.v * state.v * k * dt;
  } else if (!direction) {
    state.lateral -= Math.sign(state.lateral) * Math.min(Math.abs(state.lateral), c.straightReturn * dt);
  }
}

function stepRun(state, controls, dt) {
  const c = LUGE_CONFIG;
  state.time += dt;
  const k = curvatureAt(state.s);
  steer(state, controls, k, dt);
  const outer = outerSide(k, state.lateral);
  const acceleration = c.gravity - c.drag * state.v * state.v - (controls.down ? c.brake : 0)
    + c.turnGain * (Math.abs(k) / c.kMax) * outer;
  state.v = Math.max(0, state.v + acceleration * dt);
  state.s += state.v * dt;

  if (Math.abs(state.lateral) >= 1) {
    state.lateral = Math.sign(state.lateral);
    crash(state, 'wall');
  } else if (Math.abs(k) > c.kSafeMin && state.v > vSafe(k, state.lateral)) {
    crash(state, 'speed');
  } else if (state.s >= FINISH_S) {
    state.time -= (state.s - FINISH_S) / state.v;
    state.s = FINISH_S;
    state.phase = 'finished';
    state.events.push({ type: 'finish' });
  } else if (state.time >= c.timeLimit) {
    crash(state, 'time');
  }
}

export function stepLuge(state, controls, dt) {
  state.events = [];
  if (state.phase === 'ready' && controls.pushes > 0) {
    state.phase = 'pushing';
    state.events.push({ type: 'start' });
  }
  if (state.phase === 'pushing') stepPush(state, controls, dt);
  else if (state.phase === 'running') stepRun(state, controls, dt);
}
```

- [ ] **Step 2: Update the simulation tests (`tests/events/luge/lugeSim.test.js`)**

Read the file first. Make exactly these changes:

a) In the test `'too much speed in a turn is a crash, a safe speed is not'` change the bound assertion to `assert.ok(limit > 30 && limit < 35, ...)` (vSafe(0.045) is now √(48/0.045) ≈ 32.7 m/s). The fast/safe cases (`limit + 5`, `limit - 5`) stay.

b) Append these tests (the file already imports `createLugeState`, `LUGE_CONFIG`, `speedLimitAhead`, `stepLuge`, `vSafe`, and `TURNS`, `FINISH_S`, `RED_LINE_S`; add `vSafeOuter` to the import from `lugeSim.js`):

```js
test('in a turn the sled drifts toward the outer wall, harder at higher speed', () => {
  const driftAt = (v) => {
    const state = running({ v, lateral: 0 });
    stepLuge(state, NONE, DT);
    return state.lateral;
  };
  assert.ok(driftAt(30) < 0, 'a right turn pushes the sled to the left');
  assert.ok(driftAt(45) < driftAt(30), 'more speed drifts harder');
  const left = running({ s: 412, v: 30, lateral: 0 }); // turn 4 is a left turn
  stepLuge(left, NONE, DT);
  assert.ok(left.lateral > 0, 'a left turn pushes the sled to the right');
});

test('steering against the drift holds the line', () => {
  const state = running({ v: 30, lateral: -0.3 });
  for (let i = 0; i < 30; i++) stepLuge(state, { ...NONE, right: true }, DT);
  assert.ok(state.lateral > -0.3, `lateral ${state.lateral}`);
});

test('there is no drift and no pull to the centre in a turn, but a pull on a straight', () => {
  const turn = running({ v: 0.001, lateral: -0.5 });
  stepLuge(turn, NONE, DT);
  assert.ok(Math.abs(turn.lateral - -0.5) < 1e-3, `lateral ${turn.lateral}`);
  const straight = running({ s: 40, lateral: -0.5 });
  stepLuge(straight, NONE, DT);
  assert.ok(straight.lateral > -0.5);
});

test('the safe speed is higher on the outer side and lower on the inner side', () => {
  const k = TURNS[0].k; // a right turn: lateral < 0 is the outer side
  assert.ok(vSafe(k, -0.8) > vSafe(k, 0));
  assert.ok(vSafe(k, 0) > vSafe(k, 0.8));
  assert.equal(vSafe(k), vSafe(k, 0));
  assert.equal(vSafe(k, -1), vSafeOuter(k, 1));
});

test('a run still going after the time limit is rejected as too slow', () => {
  const state = running({ s: 40, v: 5, time: LUGE_CONFIG.timeLimit - DT / 2 });
  stepLuge(state, NONE, DT);
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'time');
  assert.deepEqual(state.events, [{ type: 'crash' }]);
});
```

- [ ] **Step 3: Update the bot helper and the balance tests**

In `tests/helpers/lugeBot.js` change the `BOTS` and the `down` line:

```js
export const BOTS = {
  good: { pushEvery: 7, look: 120, margin: 0.97, outer: 0.35 },
  centre: { pushEvery: 7, look: 120, margin: 0.97, outer: 0 },
  average: { pushEvery: 14, look: 60, margin: 0.8, outer: 0.2 },
};
```
and `down: state.v > speedLimitAhead(state.s, profile.look, profile.outer) * profile.margin,`. Update the comment above `BOTS` so that `outer` also says it is the position the bot assumes when it computes the speed limit.

In `tests/events/luge/bot.test.js` replace the first two tests and add the new ones (keep the existing "no input" and "holding a steering key" tests as they are):

```js
test('a good line finishes in about 30 s and earns full points', () => {
  const state = runBot(BOTS.good);
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 28.5 && state.time < 30.5, `good took ${state.time}`);
  assert.ok(lugePoints(state.time) >= 55);
});

test('staying on the centre line is clearly slower than the outer line', () => {
  const good = runBot(BOTS.good);
  const centre = runBot(BOTS.centre);
  assert.equal(centre.phase, 'finished');
  assert.ok(centre.time > 30.5 && centre.time < 33, `centre took ${centre.time}`);
  assert.ok(centre.time - good.time > 1.5);
});

test('an average line is slower still but finishes', () => {
  const state = runBot(BOTS.average);
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 33 && state.time < 36.5, `average took ${state.time}`);
});

test('braking alone, without steering, never finishes the track', () => {
  for (let limit = 20; limit <= 48; limit += 4) {
    const state = createLugeState();
    for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
      const braking = state.phase === 'running' && state.v > limit;
      stepLuge(state, { left: false, right: false, down: braking, pushes: tick % 7 === 0 ? 1 : 0 }, DT);
    }
    assert.equal(state.phase, 'crashed', `braking above ${limit} m/s finished in ${state.time}`);
  }
});

test('holding the brake for the whole run times out', () => {
  const state = createLugeState();
  for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
    stepLuge(state, { left: false, right: false, down: state.phase === 'running', pushes: tick % 7 === 0 ? 1 : 0 }, DT);
  }
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'time');
});
```

- [ ] **Step 4: Scene label and test**

In `game/events/luge/lugeScene.js` add to `CRASH_LABEL`: `time: 'AIKA YLITTYI',`. In `tests/events/luge/lugeScene.test.js`, in the test `'buildAttempt scores finished runs and labels the crash reasons'` add:

```js
  const slow = { ...createLugeState(), phase: 'crashed', reason: 'time', time: 45 };
  assert.deepEqual(buildAttempt(slow), { valid: false, points: 0, time: 45, summary: ['AIKA 45,00 S', 'HYLÄTTY', 'AIKA YLITTYI'] });
```

- [ ] **Step 5: Run the luge tests**

Run: `node --test tests/events/luge`
Expected: all pass. If a balance window fails, do NOT change the game constants silently: report the measured times (good / centre / average) and stop with status DONE_WITH_CONCERNS.

- [ ] **Step 6: Update the design document**

In `plans/2026-10-08-luge-design.md`:
- Rules, turns bullet: append "In a turn the sled also drifts toward the outer wall (`lateral −= driftGain · v² · k · dt`), so the player has to steer inward; the pull back to the centre exists only on straights. The safe speed depends on the position: `vSafe = √(A / |k|) · (1 + outerSafe · outer)`, higher on the outer side, lower on the inner side."
- Rules, crash bullet: add "A run still going after 45 s is also rejected (`AIKA YLITTYI`), so braking alone cannot finish a run."
- Physics values: gravity 9.3 m/s², lateral rate 2.6 per second, return 0.4 per second on straights only, drift gain 0.025, turn gain 8 m/s² (at `|k| = 0.045`), `A = 48` (centre line ≈ 32.7 m/s ≈ 118 km/h in the tightest turn), `outerSafe = 0.4`, time limit 45 s. Result lines: add `AIKA YLITTYI` as a third crash reason.
- Testing bot line: "good line (strong push, outer line 0.35): 28.5–30.5 s; centre line 30.5–33 s; average 33–36.5 s; no steering or braking alone: crash".

- [ ] **Step 7: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/luge/lugeSim.js game/events/luge/lugeScene.js tests plans/2026-10-08-luge-design.md plans/2026-10-08-luge-steering.md
git commit -m "feat: make luge steering necessary with drift, position-dependent safe speed and a time limit

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
