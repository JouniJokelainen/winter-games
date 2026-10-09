# Luge: a bit more start speed from tapping – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playtest feedback: tapping Space in the push phase could raise the start speed a bit more.

**Architecture:** Config-only change: a larger push gain per press, a higher cap, and a red line moved further out so the push still takes about 5 s at a strong tapping rate. Values were tuned with a prototype on the real track.

**Tech Stack:** Plain ES modules, `node --test`. No new packages.

## Global Constraints

- Code and comments in English. No new packages. Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Push rule unchanged (proportional decay, ends at the red line, clock counts the push). Work in `.worktrees/luge` (branch `feature/luge`).

## Values (measured on the real track)

| | before | after |
|---|---|---|
| `pushGain` | 1 | **1.3** |
| `pushMax` | 8 | **12** |
| `RED_LINE_S` | 22 | **30** |

Push time / start speed: 12 taps/s 3.7 s / 9.2 m/s; 8.6 taps/s 4.9 s / 6.8 m/s (before 4.7 s / 5.1); 4 taps/s 9.7 s / 2.8 m/s. Bots: good 29.8 s, centre 31.7 s, average 34.7 s, careless 31.8 s, fast (tap every 5 ticks) 28.4 s, lazy (every 15 ticks) 35.0 s. One tap and no more takes about 30 s of pushing, which exceeds the 45 s limit once the slope is added, so such a run is rejected.

---

### Task 1: More start speed from tapping

**Files:**
- Modify: `game/events/luge/lugeSim.js`, `game/events/luge/lugeTrack.js`, `tests/events/luge/lugeSim.test.js`, `plans/2026-10-08-luge-design.md`

- [ ] **Step 1: Config**

In `LUGE_CONFIG` of `game/events/luge/lugeSim.js` set `pushGain: 1.3` and `pushMax: 12`. In `game/events/luge/lugeTrack.js` set `RED_LINE_S = 30`. Leave comments and every other value as they are.

- [ ] **Step 2: Test numbers**

In `tests/events/luge/lugeSim.test.js`:
- test `'without tapping the runner keeps walking and still reaches the red line'`: the time window becomes `assert.ok(state.time > 26 && state.time < 34, ...)` (30 m at 1 m/s).
- if any other expectation in the push tests fails because of the new values (for example the 3–6 s window of the red-line test, which should still hold at ≈ 4.9 s), report it with the measured value rather than changing game constants; a plain numeric window adjustment in a test is fine if it keeps the test meaningful.

- [ ] **Step 3: Run the luge tests**

Run: `node --test tests/events/luge`
Expected: all pass; balance windows hold (good ≈ 29.8, centre ≈ 31.7, average ≈ 34.7, careless ≈ 31.8, fast ≈ 28.4, lazy ≈ 35.0).

- [ ] **Step 4: Design document**

In `plans/2026-10-08-luge-design.md` update the push numbers: each press adds 1.3 m/s, cap 12 m/s, red line 30 m from the start; the push takes about 4.9 s at 8.6 taps/s (start speed 6.8 m/s), 3.7 s at 12 taps/s (9.2 m/s), 9.7 s at 4 taps/s (2.8 m/s); with no tapping the push alone takes about 30 s, so the run is rejected by the 45 s limit. Update the physics values (`pushGain 1.3`, `pushMax 12`) and the testing line (fast ≈ 1.4 s faster, lazy ≈ 5.2 s slower than the good line).

- [ ] **Step 5: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/luge tests plans/2026-10-08-luge-design.md plans/2026-10-08-luge-push-boost.md
git commit -m "feat: give the luge push a bit more start speed per tap

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
