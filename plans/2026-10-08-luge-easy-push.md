# Luge: an easier good start – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playtest request: a good start should be easier. Tapping Space 6–8 times per second must be enough for the best start speed.

**Architecture:** The push model changes from "each press adds speed, speed decays" (a sawtooth that never saturates cleanly) to a smoothed tapping rate: the sim keeps `tapRate` (an exponential average of presses per second) and the push speed eases toward `tapRate · speedPerTap`, clamped to `[pushMin, pushMax]`. Speed grows with the tapping rate up to 6.2 taps/s and stays at the maximum above that. Values were tuned with a prototype on the real track.

**Tech Stack:** Plain ES modules, `node --test`. No new packages.

## Global Constraints

- Code and comments in English. No new packages. Commit message ends with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- The push still ends at the red line (20 m), the clock counts the push, the speed at the line is the entry speed of the slope. Steering/over-speed rules unchanged. Work in `.worktrees/luge` (branch `feature/luge`).

## Model and values

Per tick (dt = 1/60 s) while pushing:

```
tapRate += (pushes / dt − tapRate) · min(1, dt / tapSmooth)
target   = clamp(tapRate · speedPerTap, pushMin, pushMax)
v       += (target − v) · (1 − exp(−dt / pushLag))
v        = max(v, pushMin)
```
`speedPerTap` 1.3 (m/s per tap per second), `pushMax` 8, `pushMin` 1, `tapSmooth` 0.4 s, `pushLag` 0.3 s. `pushGain`, `pushRate` are removed. `gravity` 8 → 7 (the start is now a little faster, the lower gravity keeps a clean run near 30 s). `createLugeState()` gains `tapRate: 0`.

Measured (red line 20 m): tapping every 15 ticks (4/s) 4.4 s push / 5.3 m/s; every 10 ticks (6/s) 3.2 s / 7.5 m/s; every 7 ticks (8.6/s) 2.9 s / 8.0 m/s (the maximum); 12/s the same as 8.6/s; one tap and no more 19.6 s. Bots (profiles `good` 7, `centre` 7, `average` 14, `careless` 9, `fast` 5, `lazy` 15 ticks between taps): good 29.8 s, centre 31.6 s, average 34.9 s, careless 31.5 s, fast 29.7 s, lazy 31.5 s, racing-line bot 28.97 s (widest lateral 0.59).

---

### Task 1: Easier good start

**Files:**
- Modify: `game/events/luge/lugeSim.js`, `tests/events/luge/lugeSim.test.js`, `tests/events/luge/bot.test.js`, `tests/helpers/lugeBot.js`, `plans/2026-10-08-luge-design.md`

- [ ] **Step 1: Sim**

In `game/events/luge/lugeSim.js`:

a) In `LUGE_CONFIG` replace the `pushGain` and `pushRate` entries (and their comments) with:

```js
  speedPerTap: 1.3, // push speed in m/s per tap per second: 6.2 taps/s already gives the maximum
  tapSmooth: 0.4, // seconds over which the tapping rate is averaged
  pushLag: 0.3, // seconds the push speed takes to follow the tapping rate
```
keep `pushMin: 1` and `pushMax: 8` (change `pushMax` from 12 to 8), and set `gravity: 7`.

b) `createLugeState()` returns `{ phase: 'ready', s: 0, v: 0, lateral: 0, time: 0, tapRate: 0, reason: null, events: [] }`.

c) Replace the `state.v = ...` line in `stepPush` with:

```js
  state.tapRate += (controls.pushes / dt - state.tapRate) * Math.min(1, dt / c.tapSmooth);
  const target = Math.min(c.pushMax, Math.max(c.pushMin, state.tapRate * c.speedPerTap));
  state.v = Math.max(c.pushMin, state.v + (target - state.v) * (1 - Math.exp(-dt / c.pushLag)));
```
(keep the lines around it: `state.time += dt;`, `state.s += state.v * dt;` and the red-line check).

- [ ] **Step 2: Sim tests (`tests/events/luge/lugeSim.test.js`)**

Read the file. Then:

a) Replace the test `'pushes raise the speed up to the cap and it decays without them'` with:

```js
test('tapping raises the push speed up to the cap and it falls back without taps', () => {
  const state = Object.assign(createLugeState(), { phase: 'pushing', v: 1 });
  for (let i = 0; i < 120; i++) stepLuge(state, { ...NONE, pushes: i % 5 === 0 ? 1 : 0 }, DT); // 12 taps per second
  assert.equal(state.phase, 'pushing');
  assert.ok(Math.abs(state.v - LUGE_CONFIG.pushMax) < 0.05, `v ${state.v}`);
  const tapped = state.v;
  for (let i = 0; i < 40 && state.phase === 'pushing'; i++) stepLuge(state, NONE, DT);
  assert.ok(state.v < tapped);
  for (let i = 0; i < 60 * 40 && state.phase === 'pushing'; i++) stepLuge(state, NONE, DT);
  assert.ok(state.v >= LUGE_CONFIG.pushMin);
});
```
Because `state.s` starts at 0 and 120 ticks at ≤ 8 m/s reach about 13 m, the sled is still in the push phase (the red line is at 20 m).

b) Test `'the push ends at the red line and the push speed carries on to the slope'`: change its time window to `assert.ok(state.time > 2 && state.time < 5, ...)` (≈ 2.9 s at 8.6 taps/s).

c) Test `'without tapping the runner keeps walking and still reaches the red line'`: keep (16–24 s window, ≈ 19.6 s).

d) Replace the test `'the faster the player taps, the shorter the push and the higher the start speed'` with:

```js
test('more taps give more start speed up to the maximum, and 6-8 taps per second are enough for it', () => {
  const push = (everyTicks) => {
    const state = createLugeState();
    for (let tick = 0; tick < 60 * 40 && state.phase !== 'running'; tick++) {
      stepLuge(state, { ...NONE, pushes: tick % everyTicks === 0 ? 1 : 0 }, DT);
    }
    return state;
  };
  const slow = push(15); // 4 taps per second
  const six = push(10); // 6 taps per second
  const eight = push(7); // 8.6 taps per second
  const twelve = push(5); // 12 taps per second
  assert.ok(slow.time > six.time && six.time > eight.time, `${slow.time} ${six.time} ${eight.time}`);
  assert.ok(slow.v < six.v - 1, `${slow.v} ${six.v}`);
  assert.ok(six.v > 0.9 * LUGE_CONFIG.pushMax, `6 taps per second gave ${six.v}`);
  assert.ok(Math.abs(eight.v - LUGE_CONFIG.pushMax) < 0.05);
  assert.ok(Math.abs(twelve.v - eight.v) < 0.05, 'tapping faster than that adds nothing');
});
```

Any other assertion in the file that mentions `pushGain`, `pushRate` or `pushImpulse` must be updated to the new model; report anything that needs more than a number/window change.

- [ ] **Step 3: Bots (`tests/helpers/lugeBot.js`, `tests/events/luge/bot.test.js`)**

In `tests/helpers/lugeBot.js` set `average.pushEvery` to `14` and `careless.pushEvery` to `9` (the `fast`, `lazy`, `good`, `centre`, `line` profiles keep their values).

In `tests/events/luge/bot.test.js` keep the balance windows (good 28.5–30.5, centre 30.5–33, average 33–36.5, careless 30–34, line 28–30.5) and replace the test `'tapping faster saves time and tapping slowly costs time, with the same driving line'` with:

```js
test('tapping slowly costs time, and tapping faster than 6-8 per second adds nothing', () => {
  const good = runBot(BOTS.good); // 8.6 taps per second
  const fast = runBot(BOTS.fast); // 12 taps per second
  const lazy = runBot(BOTS.lazy); // 4 taps per second
  assert.equal(fast.phase, 'finished');
  assert.equal(lazy.phase, 'finished');
  assert.ok(Math.abs(good.time - fast.time) < 0.3, `fast ${fast.time} vs good ${good.time}`);
  assert.ok(lazy.time - good.time > 1, `lazy ${lazy.time} vs good ${good.time}`);
});
```

- [ ] **Step 4: Run the luge tests**

Run: `node --test tests/events/luge`
Expected: all pass (good ≈ 29.8, centre ≈ 31.6, average ≈ 34.9, careless ≈ 31.5, fast ≈ 29.7, lazy ≈ 31.5, line ≈ 28.97). If a balance window or the new push tests fail, do not change game constants: report the measured values and stop with DONE_WITH_CONCERNS.

- [ ] **Step 5: Design document**

In `plans/2026-10-08-luge-design.md` replace the push description and push physics values with the new model: the sim averages the tapping rate (`tapSmooth` 0.4 s), the push speed follows `tapRate × 1.3 m/s` (lag 0.3 s), clamped to 1–8 m/s, so 6–8 taps per second already give the maximum start speed (6 taps/s 7.5 m/s, 8.6 taps/s 8.0 m/s, 4 taps/s 5.3 m/s); the push ends at the red line 20 m from the start and takes about 2.9 s at the maximum, 4.4 s at 4 taps/s, about 20 s with no tapping; gravity 7. Update the bot times (good 29.8, centre 31.6, average 34.9, careless 31.5, fast ≈ good, lazy ≈ 1.7 s slower).

- [ ] **Step 6: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/luge tests plans/2026-10-08-luge-design.md plans/2026-10-08-luge-easy-push.md
git commit -m "feat: make the luge start easier, 6-8 taps per second give the best push

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```
