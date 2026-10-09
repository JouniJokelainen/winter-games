# Luge: stronger outward slide in turns – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playtest feedback: the sled should slide toward the outer edge of a turn more strongly, so the player has to steer even more.

**Architecture:** A config-only change in `lugeSim.js` (no new rules), plus the numbers that follow from it in two tests and the design doc. Values were tuned with a prototype on the real track.

**Tech Stack:** Plain ES modules, `node --test`. No new packages.

## Global Constraints

- Code and comments in English. No new packages. Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Steering must stay necessary and over-speed must slide the sled over the outer rim (no speed-crash rule).
- Work in `.worktrees/luge` (branch `feature/luge`).

## Values (measured on the real track, 1/60 s steps)

| | before | after |
|---|---|---|
| `driftGain` | 0.0464 | **0.07** (outward slide 1.5× at the same speed) |
| `lateralRate` | 2.6 | **3.2** (a little more steering authority, so the sled stays controllable) |
| `gravity` | 8.3 | **11** (keeps the clean-run time near 30 s because the lower hold speeds cost time) |

Hold speed (full steering still holds the line) in the tightest turn (k = 0.045): centre 115 km/h (was 127), outer 162 (was 180), inner 94 (was 104). Bots: good 29.9 s, centre 31.8 s, average 35.0 s, careless 31.6 s. Steering and no braking slides over the rim at s ≈ 660; no input crashes (rim); always braking times out; braking above any speed from 20 m/s without steering crashes; with steering, a fixed speed of 44 m/s still finishes the track and 48 m/s slides over the rim at the tight turn.

---

### Task 1: Stronger drift

**Files:**
- Modify: `game/events/luge/lugeSim.js`, `tests/events/luge/lugeSim.test.js`, `plans/2026-10-08-luge-design.md`

- [ ] **Step 1: Config**

In `LUGE_CONFIG` of `game/events/luge/lugeSim.js` set `gravity: 11`, `lateralRate: 3.2`, `driftGain: 0.07` (leave every other value and all comments as they are).

- [ ] **Step 2: Test numbers**

In `tests/events/luge/lugeSim.test.js` the test `'the hold speed of the tightest turn is about 127 km/h on the centre line'`: rename it to `... is about 115 km/h on the centre line` and change its bound to `assert.ok(limit > 29 && limit < 34, ...)` (the hold speed is now √(3.2 / (0.07 · 0.045)) ≈ 31.9 m/s). No other test needs a new number; if another one fails, report it with the measured values instead of changing game constants.

- [ ] **Step 3: Run the luge tests**

Run: `node --test tests/events/luge`
Expected: all pass; the balance windows hold (good ≈ 29.9, centre ≈ 31.8, average ≈ 35.0, careless ≈ 31.6).

- [ ] **Step 4: Design document**

In `plans/2026-10-08-luge-design.md` update every number that depends on these values: gravity 11, lateral rate 3.2, drift gain 0.07; the hold speeds of the tightest turn become 115 km/h (centre), 162 km/h (outer), 94 km/h (inner) wherever 127/180/104 appear.

- [ ] **Step 5: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/luge/lugeSim.js tests/events/luge/lugeSim.test.js plans/2026-10-08-luge-design.md plans/2026-10-08-luge-stronger-drift.md
git commit -m "feat: make the luge sled slide harder toward the outer edge in turns

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
