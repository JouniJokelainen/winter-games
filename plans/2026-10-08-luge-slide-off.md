# Luge: too much speed slides the sled over the outer rim – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the abrupt "speed over the limit = instant crash" rule. Instead the physics decides: too much speed makes the outward slide in a turn stronger than the player's steering, so the sled slides up the outer wall and over the rim. The player has to brake and steer so that it does not.

**Architecture:** In `lugeSim.js` the speed-limit crash is deleted; the drift term gets a position factor (the banked outer wall supports the sled, the inner side does not) and a new gain. The "safe speed" functions keep their names and now mean "the highest speed at which full steering still holds the line" (used by the HUD marker, the warning and the bots). Values were tuned with a prototype on the real track.

**Tech Stack:** Plain ES modules, `node --test`. No new packages.

## Global Constraints

- Code, identifiers and comments in English; on-screen texts Finnish upper case.
- No new packages. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Product rules unchanged: a crash is a rejected run; 30 s = 60 points; steering must stay necessary (no-steering and brake-only runs must keep crashing).
- The only crash causes are now: the sled reaches the rim (`'wall'`) and the 45 s time limit (`'time'`). The reason `'speed'` no longer exists.
- Work in `.worktrees/luge` (branch `feature/luge`).

## Physics (new)

- Drift in a turn (continuous in `k`, no cut-off): `lateral −= driftGain · v² · k · (1 − bankSupport · outer) · dt`, with `outer = −lateral · sign(k)` in −1…+1 (+1 = outer wall). `driftGain = 0.0464`, `bankSupport = 0.5`.
- Steering moves `lateral` by `lateralRate = 2.6` per second. Full steering holds the line while `driftGain · v² · |k| · (1 − bankSupport · outer) ≤ lateralRate`, i.e. up to `vHold = √(lateralRate / (driftGain · |k| · (1 − bankSupport · outer)))`: 35.3 m/s (127 km/h) on the centre line of the tightest turn (k = 0.045), 49.9 m/s (180 km/h) on the outer side, 28.8 m/s (104 km/h) on the inner side. Above that the sled slides outward at the surplus rate and hits the rim unless the turn ends first (a small overspeed is survivable, a big one is not).
- `kSafeMin = 0.004` stays only as the curvature below which a straight's pull to the centre applies and the HUD/bots ignore the bend. `gravity` 7.8 → 8.3. `safeA`, `outerSafe`, `innerSafe` are removed.

Measured with the bots on the real track (1/60 s steps): good line 29.4 s, centre line 31.1 s, average 34.3 s, careless 31.2 s; no input crashes into the rim at s = 441; always braking times out; braking above any speed from 20 to 56 m/s without steering always crashes; holding a steering key crashes into the rim; steering well but never braking crashes into the rim at the tight turn 7 (s = 670).

---

### Task 1: Over-speed slides the sled over the rim

**Files:**
- Modify: `game/events/luge/lugeSim.js`, `game/events/luge/lugeScene.js`
- Modify: `tests/events/luge/lugeSim.test.js`, `tests/events/luge/bot.test.js`, `tests/events/luge/lugeScene.test.js`
- Modify: `plans/2026-10-08-luge-design.md`

**Interfaces:**
- Produces (semantics changed, names kept): `vSafeOuter(k, outer)` = `√(lateralRate / (driftGain · |k| · (1 − bankSupport · outer)))`; `vSafe(k, lateral = 0)`; `speedLimitAhead(s, distance, outer = 0)`; `speedLimitAtLateral(s, distance, lateral)` — all return the speed at which full steering still holds the line. `LUGE_CONFIG` loses `safeA`, `outerSafe`, `innerSafe` and gains `bankSupport`. `stepLuge` never sets `state.reason === 'speed'`.

- [ ] **Step 1: Replace `game/events/luge/lugeSim.js` from the config to `stepRun`**

Read the file. Keep `createLugeState`, `stepPush`, `crash`, `stepLuge` and the imports exactly as they are. Make these changes:

a) Replace `LUGE_CONFIG` with:

```js
export const LUGE_CONFIG = {
  pushImpulse: 0.3, // speed added per Space press while pushing
  pushDecay: 0.8, // speed lost per second while pushing
  pushMin: 1, // the runner never stops walking
  pushMax: 4,
  gravity: 8.3,
  drag: 0.0022,
  brake: 22,
  lateralRate: 2.6, // lateral units per second while an arrow is held
  straightReturn: 0.4, // lateral units per second back to the centre on a straight with no arrow held
  driftGain: 0.0464, // outward slide in a turn: lateral units per second = driftGain · v² · |k| · (1 - bankSupport · outer)
  bankSupport: 0.5, // the banked outer wall carries the sled (less slide), the inner side does not (more slide)
  turnGain: 8, // speed change (m/s²) at kMax with the sled fully on the outer (+) or inner (-) side
  kMax: 0.045,
  kSafeMin: 0.004, // below this curvature a bend counts as straight: no look-ahead limit, pull to the centre
  lookStep: 5,
  timeLimit: 45, // a run still going after this many seconds is rejected
};
```

b) Replace `vSafeOuter` with (keep `outerSide`, `vSafe`, `speedLimitAhead`, `speedLimitAtLateral` as they are, only fix the comments to say "the speed at which full steering still holds the line"):

```js
// The highest speed at which full steering (lateralRate) still holds the line: the outward slide equals the steering.
export function vSafeOuter(k, outer) {
  const c = LUGE_CONFIG;
  return Math.sqrt(c.lateralRate / (c.driftGain * Math.abs(k) * (1 - c.bankSupport * outer)));
}
```

c) Replace `steer` with:

```js
function steer(state, controls, k, dt) {
  const c = LUGE_CONFIG;
  const direction = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
  state.lateral += direction * c.lateralRate * dt;
  state.lateral -= c.driftGain * state.v * state.v * k * (1 - c.bankSupport * outerSide(k, state.lateral)) * dt;
  if (Math.abs(k) <= c.kSafeMin && !direction) {
    state.lateral -= Math.sign(state.lateral) * Math.min(Math.abs(state.lateral), c.straightReturn * dt);
  }
}
```

d) In `stepRun` delete the whole `else if (Math.abs(k) > c.kSafeMin && state.v > vSafe(k, state.lateral)) { crash(state, 'speed'); }` branch. Everything else in `stepRun` stays.

- [ ] **Step 2: Scene label**

In `game/events/luge/lugeScene.js`: in `CRASH_LABEL` change `wall: 'OSUIT LAITAAN'` to `wall: 'SUISTUIT RADALTA'` and delete the `speed:` entry. Let the crashed sled slide visibly over the rim during the hold: in `render()`, replace the `lateral:` line of the view with

```js
      lateral: this.displayLateral(),
```
and add the method

```js
  // A crashed sled keeps sliding outward over the rim during the hold; otherwise the lateral position is clamped to the trough.
  displayLateral() {
    const { state } = this;
    const lateral = Math.max(-1, Math.min(1, state.lateral));
    if (state.phase !== 'crashed' || state.reason !== 'wall') return lateral;
    return lateral * (1 + SLIDE_OVER_RIM * Math.min(1, this.holdTime / SLIDE_SECONDS));
  }
```
with the constants `const SLIDE_OVER_RIM = 0.3;` and `const SLIDE_SECONDS = 0.5;` next to the other constants.

- [ ] **Step 3: Update `tests/events/luge/lugeSim.test.js`**

Read the file. Make these changes:

a) Replace the test `'too much speed in a turn is a crash, a safe speed is not'` with:

```js
test('the hold speed of the tightest turn is about 127 km/h on the centre line', () => {
  const limit = vSafe(TURNS[6].k);
  assert.ok(limit > 33 && limit < 38, `vSafe(${TURNS[6].k}) = ${limit}`);
});

test('too much speed slides the sled over the outer rim even when steering, a safe speed holds', () => {
  const drive = (v) => {
    const state = running({ s: TIGHTEST_TURN - 15, v, lateral: 0 });
    for (let i = 0; i < 90 && state.phase === 'running' && state.s < TIGHTEST_TURN + 40; i++) {
      stepLuge(state, { ...NONE, left: state.lateral > 0, right: state.lateral < 0 }, DT); // keep the sled in the middle
    }
    return state;
  };
  const fast = drive(50);
  assert.equal(fast.phase, 'crashed');
  assert.equal(fast.reason, 'wall');
  assert.equal(fast.lateral, -1, 'a right turn: the sled leaves over the left (outer) rim');
  const safe = drive(25);
  assert.equal(safe.phase, 'running');
  assert.ok(Math.abs(safe.lateral) < 0.5);
});

test('speed alone never ends a run: a fast sled with no steering is stopped only by the rim', () => {
  const state = running({ s: TIGHTEST_TURN, v: 60, lateral: 0 });
  stepLuge(state, NONE, DT);
  assert.equal(state.phase, 'running');
});
```

b) Replace the test `'the inner side loses less safe speed than the outer side gains'` with:

```js
test('the outer side holds more speed than the centre and the inner side less', () => {
  const k = TURNS[0].k;
  const centre = vSafeOuter(k, 0);
  assert.ok(Math.abs(vSafeOuter(k, 1) / centre - 1 / Math.sqrt(0.5)) < 1e-9);
  assert.ok(Math.abs(vSafeOuter(k, -1) / centre - 1 / Math.sqrt(1.5)) < 1e-9);
});
```

c) Any remaining assertion that expects a crash with `reason === 'speed'` in this file must be removed or changed to the new behaviour. The tests `'speedLimitAhead finds the tightest turn in range'`, `'speedLimitAtLateral follows the sled position'`, the drift tests, the time-limit test and the finish test stay unchanged.

- [ ] **Step 4: Update `tests/events/luge/bot.test.js`**

The no-input test must now expect the rim: change its `assert.equal(state.reason, 'speed')` to `'wall'` and its title to `'driving without any input slides over the rim in a turn'`. Add:

```js
test('steering well but never braking slides over the rim at the tightest turn', () => {
  const state = createLugeState();
  for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
    const controls = botControls(state, { ...BOTS.good, margin: 99 }, tick);
    stepLuge(state, controls, DT);
  }
  assert.equal(state.phase, 'crashed');
  assert.equal(state.reason, 'wall');
});
```
(add `botControls` to the import from `../../helpers/lugeBot.js`). The balance windows stay: good 28.5–30.5, centre 30.5–33, average 33–36.5, careless 30–34. The braking-alone test (limits 20…48) and the always-brake test stay.

- [ ] **Step 5: Update `tests/events/luge/lugeScene.test.js`**

- In the crash test replace `assert.ok(completed[0].summary.includes('LIIAN KOVA VAUHTI'))` with `assert.ok(completed[0].summary.includes('SUISTUIT RADALTA'))`.
- In the `buildAttempt` test change the expected wall summary line `'OSUIT LAITAAN'` to `'SUISTUIT RADALTA'`.
- Append:

```js
test('a crashed sled slides over the rim during the hold', () => {
  const { scene } = makeScene();
  Object.assign(scene.state, { phase: 'crashed', reason: 'wall', s: 662, lateral: 1 });
  assert.equal(scene.displayLateral(), 1);
  scene.holdTime = 0.5;
  assert.ok(scene.displayLateral() > 1.2);
  scene.state.lateral = -1;
  assert.ok(scene.displayLateral() < -1.2);
  scene.state.phase = 'running';
  assert.equal(scene.displayLateral(), -1);
});
```

- [ ] **Step 6: Run the luge tests**

Run: `node --test tests/events/luge`
Expected: all pass, with the balance windows met (good ≈ 29.4, centre ≈ 31.1, average ≈ 34.3, careless ≈ 31.2). If a balance window or the new slide-off test fails, do not change game constants: report the measured values and stop with status DONE_WITH_CONCERNS.

- [ ] **Step 7: Update the design document**

In `plans/2026-10-08-luge-design.md`:
- Rules, crash bullet: replace the speed/wall crash text with: "A crash happens only when the sled reaches the rim (`|lateral| ≥ 1`, `SUISTUIT RADALTA`) or a run is still going after 45 s (`AIKA YLITTYI`). There is no separate speed limit: too much speed in a turn makes the outward slide stronger than the steering, so the sled slides up the outer wall and over the rim unless the player brakes in time."
- Rules, turns bullet: replace the safe-speed sentence with the new drift formula `lateral −= driftGain · v² · k · (1 − bankSupport · outer) · dt`, and say the hold speed (`√(lateralRate / (driftGain · |k| · (1 − bankSupport · outer)))`) is 127 km/h on the centre line, 180 km/h on the outer side and 104 km/h on the inner side of the tightest turn; above it the sled slides outward at the surplus rate.
- Physics values: gravity 8.3, brake 22, lateral rate 2.6, drift gain 0.0464, bank support 0.5; remove `A`, `outerSafe`, `innerSafe`.
- Presentation (HUD): the red marker shows the hold speed at the sled's current position ("the speed the steering can still hold"); a crashed sled slides over the outer rim during the hold.
- Result lines: crash reasons are `SUISTUIT RADALTA` and `AIKA YLITTYI`.
- Testing bot line: add "steering without braking slides over the rim at turn 7".

- [ ] **Step 8: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/luge tests plans/2026-10-08-luge-design.md plans/2026-10-08-luge-slide-off.md
git commit -m "feat: let over-speed slide the luge sled over the outer rim instead of a speed crash

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
