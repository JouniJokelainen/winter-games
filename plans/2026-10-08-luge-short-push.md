# Luge: a shorter push distance – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playtest feedback: the push at the start feels long. Shorten the push distance from 30 m to 20 m.

**Architecture:** Config-only change: `RED_LINE_S` 30 → 20, and `gravity` 11 → 8 so a clean run still takes about 30 s (a shorter push saves about 1.3 s, which the lower gravity gives back). Start speed per tapping rate is unchanged. Values were tuned with a prototype on the real track.

**Tech Stack:** Plain ES modules, `node --test`. No new packages.

## Global Constraints

- Code and comments in English. No new packages. Commit message ends with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Push rule unchanged (proportional decay, ends at the red line, the clock counts the push). Work in `.worktrees/luge` (branch `feature/luge`).

## Values (measured on the real track)

| | before | after |
|---|---|---|
| `RED_LINE_S` | 30 | **20** |
| `gravity` | 11 | **8** |

Push time / start speed: 12 taps/s 2.6 s / 9.6 m/s; 8.6 taps/s 3.4 s / 7.1; 6 taps/s 4.7 s / 4.4; 4 taps/s 6.6 s / 3.2; one tap and no more about 20 s. Bots: good 29.8 s, centre 31.6 s, average 34.4 s, careless 31.9 s, fast 28.7 s, lazy 33.4 s, racing-line bot 28.94 s (widest lateral 0.59).

---

### Task 1: Shorter push

**Files:**
- Modify: `game/events/luge/lugeSim.js`, `game/events/luge/lugeTrack.js`, `tests/events/luge/lugeSim.test.js`, `plans/2026-10-08-luge-design.md`

- [ ] **Step 1: Config**

In `LUGE_CONFIG` of `game/events/luge/lugeSim.js` set `gravity: 8`. In `game/events/luge/lugeTrack.js` set `RED_LINE_S = 20`. Leave comments and every other value as they are.

- [ ] **Step 2: Test numbers**

In `tests/events/luge/lugeSim.test.js`:
- test `'without tapping the runner keeps walking and still reaches the red line'`: the time window becomes `assert.ok(state.time > 16 && state.time < 24, ...)` (20 m at 1 m/s).
- if another push expectation fails because of the new values (the 3–6 s window of the red-line test should still hold at ≈ 3.4 s), report it with the measured value; a plain numeric window adjustment in a test is fine if the test stays meaningful, but never change game constants beyond Step 1.

- [ ] **Step 3: Run the luge tests**

Run: `node --test tests/events/luge`
Expected: all pass; balance windows hold (good ≈ 29.8, centre ≈ 31.6, average ≈ 34.4, careless ≈ 31.9, fast ≈ 28.7, lazy ≈ 33.4, line bot ≈ 28.94). The bot test `lazy − good > 3 s` has little margin (≈ 3.6 s): if it fails, report the measured values.

- [ ] **Step 4: Design document**

In `plans/2026-10-08-luge-design.md` update the push numbers: the red line is 20 m from the start; the push takes about 3.4 s at 8.6 taps/s (start speed 7.1 m/s), 2.6 s at 12 taps/s (9.6 m/s), 6.6 s at 4 taps/s (3.2 m/s), and about 20 s with no tapping. Update the physics values (`gravity 8`) and every bot time that appears (good 29.8 s, centre 31.6 s, average 34.4 s, careless 31.9 s, fast ≈ 1.1 s faster and lazy ≈ 3.6 s slower than good).

- [ ] **Step 5: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/luge tests plans/2026-10-08-luge-design.md plans/2026-10-08-luge-short-push.md
git commit -m "feat: shorten the luge push distance to 20 m

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```
