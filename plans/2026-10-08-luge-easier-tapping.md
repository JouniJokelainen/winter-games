# Luge: a lower tapping rate for the best start – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playtest feedback: the tapping rate needed for the best start should be lower still. Make about 4.5 taps per second enough for the maximum push speed.

**Architecture:** One constant changes in `lugeSim.js` (`speedPerTap` 1.3 → 1.78 m/s per tap per second, so the cap of 8 m/s is reached at 4.5 taps/s). Tests and bot profiles are adjusted to the new rates. Values were tuned with a prototype on the real track.

**Tech Stack:** Plain ES modules, `node --test`. No new packages.

## Global Constraints

- Code and comments in English. No new packages. Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Push model otherwise unchanged (smoothed tapping rate, ends at the red line 20 m, the clock counts the push). Work in `.worktrees/luge` (branch `feature/luge`).

## Values (measured on the real track)

`speedPerTap` 1.78. Push time / start speed: 3 taps/s (every 20 ticks) 4.2 s / 5.4 m/s; 4 taps/s (every 15) 3.4 s / 7.0; 5 taps/s (every 12) 3.0 s / 7.8; 6 taps/s (every 10) 2.9 s / 8.0 (maximum); 8.6 taps/s (every 7) 2.9 s / 8.0; one tap and no more about 20 s. Bots (ticks between taps): `good` 7 → 29.7 s, `centre` 7 → 31.5 s, `average` **14 → 20** → 35.0 s, `careless` 9 → 31.4 s, `fast` 5 → 29.7 s, `lazy` **15 → 20** → 31.4 s, racing-line bot 28.9 s (widest lateral 0.59).

---

### Task 1: Lower tapping rate

**Files:**
- Modify: `game/events/luge/lugeSim.js`, `tests/helpers/lugeBot.js`, `tests/events/luge/lugeSim.test.js`, `tests/events/luge/bot.test.js`, `plans/2026-10-08-luge-design.md`

- [ ] **Step 1: Config**

In `LUGE_CONFIG` of `game/events/luge/lugeSim.js` set `speedPerTap: 1.78` and update its comment to `push speed in m/s per tap per second: about 4.5 taps/s already give the maximum`. Nothing else changes.

- [ ] **Step 2: Bot profiles (`tests/helpers/lugeBot.js`)**

Set `average.pushEvery` to `20` and `lazy.pushEvery` to `20`. Keep the other profiles.

- [ ] **Step 3: Sim test (`tests/events/luge/lugeSim.test.js`)**

Read the file. Replace the test `'more taps give more start speed up to the maximum, and 6-8 taps per second are enough for it'` with:

```js
test('more taps give more start speed up to the maximum, and about 4-5 taps per second are enough for most of it', () => {
  const push = (everyTicks) => {
    const state = createLugeState();
    for (let tick = 0; tick < 60 * 40 && state.phase !== 'running'; tick++) {
      stepLuge(state, { ...NONE, pushes: tick % everyTicks === 0 ? 1 : 0 }, DT);
    }
    return state;
  };
  const three = push(20); // 3 taps per second
  const four = push(15); // 4 taps per second
  const five = push(12); // 5 taps per second
  const six = push(10); // 6 taps per second
  const eight = push(7); // 8.6 taps per second
  const twelve = push(5); // 12 taps per second
  assert.ok(three.time > four.time && four.time > six.time, `${three.time} ${four.time} ${six.time}`);
  assert.ok(three.v < four.v - 1, `${three.v} ${four.v}`);
  assert.ok(four.v > 0.85 * LUGE_CONFIG.pushMax, `4 taps per second gave ${four.v}`);
  assert.ok(five.v > 0.95 * LUGE_CONFIG.pushMax, `5 taps per second gave ${five.v}`);
  assert.ok(Math.abs(six.v - LUGE_CONFIG.pushMax) < 0.05);
  assert.ok(Math.abs(eight.v - six.v) < 0.05 && Math.abs(twelve.v - six.v) < 0.05, 'tapping faster than that adds nothing');
});
```
The other push tests (cap, red line window 2–5 s, no tapping 16–24 s) stay as they are.

- [ ] **Step 4: Bot test (`tests/events/luge/bot.test.js`)**

Keep the balance windows (good 28.5–30.5, centre 30.5–33, average 33–36.5, careless 30–34, line 28–30.5). In the test `'tapping slowly costs time, and tapping faster than 6-8 per second adds nothing'` fix the title and comments for the new rates (`lazy` = 3 taps per second, `good` = 8.6, `fast` = 12; title: `'tapping slowly costs time, and tapping faster than about 5 per second adds nothing'`). The assertions stay (`|good − fast| < 0.3`, `lazy − good > 1`).

- [ ] **Step 5: Run the luge tests**

Run: `node --test tests/events/luge`
Expected: all pass (good ≈ 29.7, centre ≈ 31.5, average ≈ 35.0, careless ≈ 31.4, fast ≈ 29.7, lazy ≈ 31.4, line ≈ 28.9). If a window or the push test fails, do not change game constants: report the measured values and stop with DONE_WITH_CONCERNS.

- [ ] **Step 6: Design document**

In `plans/2026-10-08-luge-design.md` update the push text and numbers: the push speed follows `tapRate × 1.78 m/s`, so about 4.5 taps per second already give the maximum 8 m/s (3 taps/s 5.4 m/s in 4.2 s, 4 taps/s 7.0 m/s in 3.4 s, 5 taps/s 7.8 m/s in 3.0 s, 6 taps/s and more 8.0 m/s in 2.9 s, one tap about 20 s), the physics value `speedPerTap 1.78`, and the bot times (average 35.0 s, lazy ≈ 1.7 s slower than good).

- [ ] **Step 7: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/luge tests plans/2026-10-08-luge-design.md plans/2026-10-08-luge-easier-tapping.md
git commit -m "feat: lower the tapping rate needed for the best luge start

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
