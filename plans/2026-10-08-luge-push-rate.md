# Luge: tapping speed sets the start speed – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playtest request: the faster the player taps Space in the push phase, the faster the sled goes, so tapping quickly raises the start speed. Today the push speed saturates at a 4 m/s cap with any decent tapping, so the tapping rate hardly matters.

**Architecture:** Replace the constant push decay with a decay proportional to speed, so the push speed settles at `taps per second × pushGain / pushRate`; raise the cap; move the red line further out so the push lasts about 5 s at a strong tapping rate. Values were tuned with a prototype on the real track.

**Tech Stack:** Plain ES modules, `node --test`. No new packages.

## Global Constraints

- Code and comments in English. No new packages. Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- The push still ends at the red line, the clock counts the push, the speed at the line is the entry speed of the slope. Steering/over-speed rules unchanged.
- Work in `.worktrees/luge` (branch `feature/luge`).

## Rule and values

- `v += pushGain` per Space press; `v −= pushRate · v · dt` every tick (proportional decay); `v` clamped to `[pushMin, pushMax]`. Settled speed ≈ `taps per second · pushGain / pushRate`.
- `pushGain` 1.0 (replaces `pushImpulse` 0.3), `pushRate` 1.6 (replaces `pushDecay` 0.8), `pushMax` 4 → 8, `pushMin` 1 stays. `RED_LINE_S` 15 → 22.
- Push time / entry speed by tapping rate (measured): 12 taps/s 3.5 s / 7.1 m/s; 10 taps/s 4.1 s / 6.0; 8.6 taps/s 4.65 s / 5.1; 6 taps/s 6.4 s / 4.1; 5 taps/s 7.5 s / 3.2; 4 taps/s 9.2 s / 2.2; one tap then none ≈ 22 s (the runner keeps walking at 1 m/s).
- Bots (tap every N ticks at 60 ticks/s): good 7, centre 7, average 14 → **9**, careless 9 → **8**; new `fast` 5 and `lazy` 15. Measured: good 29.9 s, centre 31.8 s, average 34.7 s, careless 31.8 s, fast 28.6 s, lazy 34.7 s.

---

### Task 1: Tapping rate sets the push speed

**Files:**
- Modify: `game/events/luge/lugeSim.js`, `game/events/luge/lugeTrack.js`
- Modify: `tests/events/luge/lugeSim.test.js`, `tests/events/luge/bot.test.js`, `tests/helpers/lugeBot.js`
- Modify: `plans/2026-10-08-luge-design.md`

- [ ] **Step 1: Track and sim**

In `game/events/luge/lugeTrack.js` change `export const RED_LINE_S = 15;` to `22`.

In `game/events/luge/lugeSim.js` `LUGE_CONFIG` replace the four push entries with:

```js
  pushGain: 1, // speed added per Space press while pushing
  pushRate: 1.6, // share of the speed lost per second while pushing: the speed settles at taps per second · pushGain / pushRate
  pushMin: 1, // the runner never stops walking
  pushMax: 8,
```
and in `stepPush` replace the `state.v = ...` line with:

```js
  state.v = Math.min(c.pushMax, Math.max(c.pushMin, state.v + controls.pushes * c.pushGain - c.pushRate * state.v * dt));
```

- [ ] **Step 2: Update the sim tests (`tests/events/luge/lugeSim.test.js`)**

Read the file, then:

a) Test `'pushes raise the speed up to the cap and it decays without them'`: replace `LUGE_CONFIG.pushImpulse` by `LUGE_CONFIG.pushGain`, and the first assertion by `assert.ok(state.v > 2 + LUGE_CONFIG.pushGain - 0.1);`. Keep the cap assertion (`LUGE_CONFIG.pushMax`), the decay assertion and the floor assertion.

b) Test `'without tapping the runner keeps walking and still reaches the red line'`: the time window becomes `assert.ok(state.time > 18 && state.time < 26, ...)`.

c) Test `'the push ends at the red line and the push speed carries on to the slope'`: keep it (tapping every 7 ticks; its window 3–6 s still holds, ≈ 4.65 s).

d) Append:

```js
test('the faster the player taps, the shorter the push and the higher the start speed', () => {
  const push = (everyTicks) => {
    const state = createLugeState();
    for (let tick = 0; tick < 60 * 40 && state.phase !== 'running'; tick++) {
      stepLuge(state, { ...NONE, pushes: tick % everyTicks === 0 ? 1 : 0 }, DT);
    }
    return state;
  };
  const fast = push(5);
  const normal = push(7);
  const slow = push(10);
  assert.ok(fast.time < normal.time && normal.time < slow.time, `${fast.time} ${normal.time} ${slow.time}`);
  assert.ok(fast.v > normal.v + 1 && normal.v > slow.v + 0.5, `${fast.v} ${normal.v} ${slow.v}`);
  assert.ok(fast.v <= LUGE_CONFIG.pushMax);
});
```

- [ ] **Step 3: Bots (`tests/helpers/lugeBot.js`, `tests/events/luge/bot.test.js`)**

In `tests/helpers/lugeBot.js` set `average.pushEvery` to `9` and `careless.pushEvery` to `8`, and add two profiles:

```js
  fast: { pushEvery: 5, look: 120, margin: 0.97, outer: 0.35, dead: 0.04 },
  lazy: { pushEvery: 15, look: 120, margin: 0.97, outer: 0.35, dead: 0.04 },
```

In `tests/events/luge/bot.test.js` keep the existing balance windows (good 28.5–30.5, centre 30.5–33, average 33–36.5, careless 30–34) and append:

```js
test('tapping faster saves time and tapping slowly costs time, with the same driving line', () => {
  const good = runBot(BOTS.good);
  const fast = runBot(BOTS.fast);
  const lazy = runBot(BOTS.lazy);
  assert.equal(fast.phase, 'finished');
  assert.equal(lazy.phase, 'finished');
  assert.ok(good.time - fast.time > 0.8, `fast ${fast.time} vs good ${good.time}`);
  assert.ok(lazy.time - good.time > 3, `lazy ${lazy.time} vs good ${good.time}`);
});
```

- [ ] **Step 4: Run the luge tests**

Run: `node --test tests/events/luge`
Expected: all pass (good ≈ 29.9, centre ≈ 31.8, average ≈ 34.7, careless ≈ 31.8, fast ≈ 28.6, lazy ≈ 34.7). If a window fails, do not change game constants: report the measured values and stop with DONE_WITH_CONCERNS.

- [ ] **Step 5: Design document**

In `plans/2026-10-08-luge-design.md`:
- Rules, push phase bullet: state that each press adds 1 m/s, the speed decays in proportion (1.6 per second), so the speed settles at taps per second ÷ 1.6 (cap 8 m/s, floor 1 m/s), that the phase ends at the red line 22 m from the start, and that the push takes about 4.7 s at 8.6 taps/s, 3.5 s at 12 taps/s, 9 s at 4 taps/s and about 22 s with no tapping, and that the speed at the line is the entry speed of the slope.
- Physics values: replace the old push values with `pushGain 1`, `pushRate 1.6`, `pushMin 1`, `pushMax 8`.
- Testing: add "tapping faster (every 5 ticks) saves about 1.3 s, tapping slowly (every 15 ticks) costs about 4.8 s".

- [ ] **Step 6: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/luge tests plans/2026-10-08-luge-design.md plans/2026-10-08-luge-push-rate.md
git commit -m "feat: let the tapping rate set the luge push speed

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
