# Luge: a more forgiving speed limit – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playtesting showed that human players crash on "too much speed" almost every run. Soften the limit and make the HUD tell the truth, while steering stays necessary.

**Architecture:** Config and one function change in `lugeSim.js`, a new look-ahead helper that uses the sled's real lateral position, the scene's HUD limit marker uses it, bot profiles gain a steering tolerance. Values were tuned with a prototype on the real track.

**Tech Stack:** Plain ES modules, `node --test`. No new packages.

## Global Constraints

- Code, identifiers and comments in English; on-screen texts Finnish upper case.
- No new packages. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Product rules unchanged: crash = rejected run; 30 s = 60 points; steering must stay necessary (no-steering and brake-only runs must keep crashing).
- Work in `.worktrees/luge` (branch `feature/luge`).

## Changes (with measured effect on the real track)

1. `safeA` 48 → 56: the centre-line limit in the tightest turn (k = 0.045) goes from 118 to 127 km/h.
2. `innerSafe` (new) = 0.2: the safe speed shrinks by at most 20 % on the inner side (it was 40 %: 71 km/h in the tightest turn, now 102 km/h). The outer side still grows by `outerSafe` = 0.4.
3. `gravity` 9.3 → 7.8 (a lower top speed on the straights, ≈ 59 m/s free speed) and `brake` 15 → 22 (shorter braking distance), so the time of a clean run stays ≈ 29–30 s.
4. The HUD limit marker and the visual warning use the limit at the sled's **current lateral position** (`speedLimitAtLateral`), not the centre line.

Prototype results (1/60 s steps): good line 29.3 s, centre line 31.4 s, average 34.1 s, careless player (steering tolerance 0.12, 50 m look-ahead, brakes at 90 %) 31.3 s; no input crashes at 15.4 s (speed); always braking times out at 45 s; braking above any speed from 20 to 48 m/s without steering always crashes; holding a steering key crashes into the rim at 4.8 s. Before the change the careless player crashed (speed) at the tight turn 7.

---

### Task 1: Soften the speed limit and show the real limit

**Files:**
- Modify: `game/events/luge/lugeSim.js`, `game/events/luge/lugeScene.js`
- Modify: `tests/helpers/lugeBot.js`, `tests/events/luge/lugeSim.test.js`, `tests/events/luge/bot.test.js`, `tests/events/luge/lugeScene.test.js`
- Modify: `plans/2026-10-08-luge-design.md`

**Interfaces:**
- Produces: `LUGE_CONFIG.innerSafe`; `vSafeOuter(k, outer)` is asymmetric (`outer ≥ 0` uses `outerSafe`, `outer < 0` uses `innerSafe`); new export `speedLimitAtLateral(s: number, distance: number, lateral: number): number` — the lowest `vSafe(k, lateral)` over the next `distance` metres (every `lookStep`), `Infinity` when no turn is in range. `speedLimitAhead(s, distance, outer = 0)` is unchanged. Bot profiles gain `dead` (steering tolerance).

- [ ] **Step 1: Change `lugeSim.js`**

Read the file. Then:

a) In `LUGE_CONFIG` set `gravity: 7.8`, `brake: 22`, `safeA: 56`, and replace the `outerSafe` line with:

```js
  outerSafe: 0.4, // the safe speed grows by this share on the fully outer side
  innerSafe: 0.2, // and shrinks by this share on the fully inner side
```

b) Replace `vSafeOuter` with:

```js
export function vSafeOuter(k, outer) {
  const share = outer >= 0 ? LUGE_CONFIG.outerSafe : LUGE_CONFIG.innerSafe;
  return Math.sqrt(LUGE_CONFIG.safeA / Math.abs(k)) * (1 + share * outer);
}
```

c) Add after `speedLimitAhead`:

```js
// Lowest safe speed over the next `distance` metres if the sled stays at `lateral`; Infinity when no turn is in range.
export function speedLimitAtLateral(s, distance, lateral) {
  let limit = Infinity;
  for (let d = 0; d <= distance; d += LUGE_CONFIG.lookStep) {
    const k = curvatureAt(s + d);
    if (Math.abs(k) > LUGE_CONFIG.kSafeMin) limit = Math.min(limit, vSafe(k, lateral));
  }
  return limit;
}
```

Also update the comment of `safeA` to `vSafe(k) = sqrt(safeA / |k|) on the centre line`.

- [ ] **Step 2: Scene uses the real limit**

In `game/events/luge/lugeScene.js` import `speedLimitAtLateral` instead of `speedLimitAhead` and change `limit()` to:

```js
  limit() {
    const { state } = this;
    return state.phase === 'running' ? speedLimitAtLateral(state.s, LIMIT_LOOK_AHEAD, state.lateral) : Infinity;
  }
```
(keep the rest unchanged; `isWarning()` and `render()` already use `this.limit()`).

- [ ] **Step 3: Update the simulation tests (`tests/events/luge/lugeSim.test.js`)**

Read the file. Add `speedLimitAtLateral` and `vSafeOuter` to the import from `lugeSim.js` if missing, then:

a) In the test `'too much speed in a turn is a crash, a safe speed is not'` change the bound assertion to `assert.ok(limit > 33 && limit < 38, ...)` (vSafe(0.045) is now √(56/0.045) ≈ 35.3 m/s).

b) Append:

```js
test('the inner side loses less safe speed than the outer side gains', () => {
  const k = TURNS[0].k;
  const centre = vSafeOuter(k, 0);
  assert.ok(Math.abs(vSafeOuter(k, 1) / centre - 1.4) < 1e-9);
  assert.ok(Math.abs(vSafeOuter(k, -1) / centre - 0.8) < 1e-9);
});

test('speedLimitAtLateral follows the sled position', () => {
  const s = TIGHTEST_TURN - 10;
  const k = TURNS[6].k; // a right turn: lateral < 0 is the outer side
  assert.equal(speedLimitAtLateral(s, 20, 0), vSafe(k));
  assert.ok(speedLimitAtLateral(s, 20, -0.8) > speedLimitAtLateral(s, 20, 0.8));
  assert.equal(speedLimitAtLateral(0, 50, 0.5), Infinity);
});
```

- [ ] **Step 4: Bot profiles with a steering tolerance**

In `tests/helpers/lugeBot.js`:
- Give every profile a `dead` field and add the careless profile:

```js
export const BOTS = {
  good: { pushEvery: 7, look: 120, margin: 0.97, outer: 0.35, dead: 0.04 },
  centre: { pushEvery: 7, look: 120, margin: 0.97, outer: 0, dead: 0.04 },
  average: { pushEvery: 14, look: 60, margin: 0.8, outer: 0.2, dead: 0.04 },
  careless: { pushEvery: 9, look: 50, margin: 0.9, outer: 0.1, dead: 0.12 },
};
```
- Remove the `STEER_DEADBAND` constant and use `profile.dead` in `left`/`right`. Extend the comment above `BOTS` with `dead: how far from the target position the bot lets the sled wander before steering back`.

In `tests/events/luge/bot.test.js` change the windows and add the careless test:

```js
test('the centre line is slower than the outer line', ...)   // keep the existing test, but with the window: centre.time > 30.5 && centre.time < 33
test('an average line ...', ...)                                // window: > 33 && < 36.5 (unchanged)
```
and append:

```js
test('a careless player with a wide steering tolerance and a short look-ahead still finishes', () => {
  const state = runBot(BOTS.careless);
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 30 && state.time < 34, `careless took ${state.time}`);
});
```
The "good line" test keeps its window 28.5–30.5. The braking-alone, always-brake, no-input and held-key tests stay unchanged.

- [ ] **Step 5: Scene test for the HUD limit**

Append to `tests/events/luge/lugeScene.test.js` (reuse its `makeScene` helper):

```js
test('the speed limit shown follows the lateral position of the sled', () => {
  const { scene } = makeScene();
  Object.assign(scene.state, { phase: 'running', s: 60, v: 30 }); // the first turn (a right turn) is ahead
  scene.state.lateral = -0.8; // outer side of that turn
  const outer = scene.limit();
  scene.state.lateral = 0.8; // inner side
  const inner = scene.limit();
  assert.ok(outer > inner, `${outer} ${inner}`);
});
```

- [ ] **Step 6: Run the luge tests**

Run: `node --test tests/events/luge`
Expected: all pass, including the balance windows (good ≈ 29.3, centre ≈ 31.4, average ≈ 34.1, careless ≈ 31.3). If a window fails, do not change game constants: report the measured times and stop with status DONE_WITH_CONCERNS.

- [ ] **Step 7: Update the design document**

In `plans/2026-10-08-luge-design.md`:
- Physics values: gravity 7.8 m/s², brake 22 m/s², `A = 56` (centre line ≈ 35.3 m/s ≈ 127 km/h in the tightest turn), `outerSafe = 0.4` (outer side up to 178 km/h there), `innerSafe = 0.2` (inner side 102 km/h).
- Rules, turns bullet: state that the safe speed grows by up to 40 % on the outer side and shrinks by up to 20 % on the inner side.
- Presentation (HUD): the red limit marker shows the safe speed at the sled's current lateral position for the tightest turn within 120 m ahead.
- Testing bot line: add "careless player (wide tolerance 0.12, short look-ahead 50 m) finishes 30–34 s; centre line 30.5–33 s".

- [ ] **Step 8: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/luge tests plans/2026-10-08-luge-design.md plans/2026-10-08-luge-forgiving.md
git commit -m "feat: soften the luge speed limit and show the limit at the sled's position

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
