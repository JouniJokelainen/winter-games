# Luge graphics: background and environment – Design and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the luge background and surroundings (sky, mountains, forest, the event venue, the walls of the track, the ice). Same realistic muted style as the other events, drawn entirely in code. Game logic does not change. This plan follows `plans/2026-10-08-luge-graphics.md` (rider, runner and start area), whose Tasks 1–2 are done or in progress; the start area (hop line, flags, start line, barriers) is built there and the venue work below builds on it.

**Architecture:** All work is in the pseudo-3D renderer `game/events/luge/lugeRender.js` and, if it grows too large, new focused modules next to it (`lugeSky.js`, `lugeForest.js`, `lugeVenue.js`) that `lugeRender.js` calls. The scene/view contract does not change (animation uses the existing `view.clock`).

**Tech Stack:** Plain ES modules, `node --test`, canvas 2D rects at 640×512. No images, fonts or packages.

## Decisions from the design interview (user-approved)

1. Setting: nature in the background (mountains, forest), the event venue only at the start, at the finish and at the outer sides of the main turns; the same tone as the other events (`drawVenueBackdrop`, `drawMistySky`, the muted palette).
2. Weather and light: stay overcast and misty (consistent with the other events), but with more depth: cloud layers, distant mountain ridges with atmospheric perspective, a dim sun disc behind the clouds.
3. Forest: denser and deeper (several layers, soft shadows), so the few huge flat pines no longer dominate.
4. Venue: stands at the start and the finish, small spectator groups on the outer side of the main turns (3–4 different outfits, a 2-frame waving animation), low advertising boards on the straights. Not too much, to keep the game fast. No real brand names: boards use plain colour fields or neutral text such as `WINTER GAMES`.
5. Track walls: a bright icy top lip and a darker inner wall, plus low padding or snow banks on the outer side of the turns. Looks only, no physics.
6. Ice surface: a subtle sheen and reflections (last, if there is time).
7. Later rounds, not in this plan: speed feel (ice spray, speed lines), crash animation, snow-cover and terrain details, lighting and shadows.
8. Limits: code only; the whole luge draw must stay well below 8 ms per frame in the browser (no-op-context cost today ≈ 3.2 ms; keep it below ≈ 5 ms).
9. Verification: before/after PNGs of every task from the harness in `.superpowers/shots/` (git-ignored), then the user plays and approves.

## Global Constraints

- Code, identifiers and comments in English; on-screen texts Finnish upper case.
- No new packages, no image files, no fonts. Commit messages end with the attribution line of the model that did the work.
- Renderer rects must be whole pixels and must not use the old retro colours (`yellow`, `ice`, `blue`, `navy`, `pine`, `brown`). Colours come from `PALETTE` (add new entries to `game/engine/palette.js` only when really needed, muted tones in the style of the existing ones).
- The simulation, scoring, controls and the balance of the bot tests do not change; existing tests keep passing. The existing render tests assert > 2000 rects per frame and whole pixels: keep them passing.
- Work in `.worktrees/luge` (branch `feature/luge`). A dev server serves this worktree to a human tester: do not start or stop servers, and keep every intermediate state of the files working (edit in small steps, run `node --test tests/events/luge` before leaving a state).
- Visual work is judged by looking: each task renders PNGs with `.superpowers/shots/shots.mjs` (extend it; it is git-ignored), opens them with the Read tool and iterates until the task's acceptance list is met. Before changing a task's drawing code, render the current frames to `.superpowers/shots/before-<task>-*.png`; save the results as `after-<task>-*.png`. Include a 2× nearest-neighbour crop of the interesting area for close inspection.
- Cost check in every task: measure the `renderLuge` ride-frame cost with a no-op context (50 calls, ms) before and after; report both; stay below ≈ 5 ms.

## Frames to render in every task

`ready` (push start, `s = −3.4`), `straight` (`s = 60`), `right turn` (`s = 108`, racing line on), `hairpin` (`s = 662`, `lateral −0.5`), `finish` (`s = 1050`), and the frame named by the task. Use plausible HUD values.

---

### Task 3: Sky, clouds and mountains

**Files:** `game/events/luge/lugeRender.js` (or a new `lugeSky.js`), tests in `tests/events/luge/lugeRender.test.js`.

**Acceptance (judge in the PNGs):**
- A smooth sky gradient (no visible hard colour bands; use many thin bands or per-row interpolation, the existing mist palette) lighter toward the horizon.
- Two or three cloud layers (soft elongated shapes, lighter and darker tones) that slide sideways with the track heading (`headingAt(s)`) at different parallax and drift slowly with `view.clock`.
- A dim, soft sun disc with a glow behind the clouds.
- Three distant mountain ridges with snow caps and atmospheric perspective (farther = lighter and bluer-grey), replacing the single soft ridge; the horizon seam to the snow plain is softened with mist.
- No visual conflict with the HUD, the banner or the forest; the frame stays readable.

- [ ] **Step 1: Failing test.** In `tests/events/luge/lugeRender.test.js` add a test that the sky is not made of a few flat bands: render a frame and collect the distinct `fillStyle` colours of rects with `y < 150` and `w ≥ 600` (full-width sky rows): there must be more than 12 distinct colours (the current sky has 5 bands). Run it, see it fail.
- [ ] **Step 2: Implement and iterate on the pictures** as described above; the frames in the "Frames to render" list plus a frame at `s = 400` to see the clouds' parallax change.
- [ ] **Step 3: Suite, cost, commit.** `npm test`; report the cost. Commit: `feat: give the luge a layered sky with clouds, a dim sun and mountain ridges`.

---

### Task 4: Forest

**Files:** `game/events/luge/lugeRender.js` (or a new `lugeForest.js`), `game/engine/scenery.js` only if a shared helper is truly better there (the ski jump and slalom use it: do not change their look), tests in `tests/events/luge/lugeRender.test.js`.

**Acceptance:**
- Three forest layers with depth: a far, dense, low and misty layer; a middle layer; near trees along the track. No single huge flat tree dominating the frame; heights vary and trees are partly hidden by fog by distance.
- Trees look less flat: a few tones (light side, shadow side, snow load on the branches), trunk visible only near; a soft shadow ellipse at the base of the nearer trees.
- Density varies naturally along the track (clearings, groups), deterministic from the seeded rng so frames are stable between runs.
- Trees do not stand on the track and keep clear of the venue objects placed by the later tasks (leave a margin zone near `along = 0…40`, the finish and the turn groups).

- [ ] **Step 1: Failing test.** Add a test that renders the `straight` frame and checks that the largest tree-trunk or tree-body rect height is smaller than 200 px (the current frame has trees > 200 px tall at the left edge) and that the number of distinct dark-green tones used is at least 4. Run it, see it fail.
- [ ] **Step 2: Implement and iterate on the pictures.**
- [ ] **Step 3: Suite, cost, commit.** `npm test`; report the cost. Commit: `feat: give the luge a deeper, denser forest`.

---

### Task 5: Venue – stands, spectators and boards

**Files:** `game/events/luge/lugeRender.js` (or a new `lugeVenue.js`), tests in `tests/events/luge/lugeRender.test.js`.

**Acceptance:**
- Tiered stands (concrete/wood with several rows of seats) at the start (beside the start area built in the graphics plan) and at the finish (both sides of the gantry), full of spectators: heads, bodies in 3–4 different outfits, some with a raised arm or a small flag; a 2-frame waving animation driven by `view.clock` (for example a 0.5 s cycle, with a per-spectator phase offset).
- A small group of spectators (4–8) on the outer side of each of the main turns (turns 3, 5, 7, 9) beyond the rim, using the same outfits and animation.
- Low advertising boards (≈ 0.8 m high, ≈ 3 m long) along the straights on both sides every ≈ 60 m, plain colour fields with neutral white text such as `WINTER GAMES` or stripes; no real brand names; the existing orange turn signs (`sign` objects) stay.
- Everything is fog-tinted by distance like the other objects; the many small spectator rects must not make the frame too slow: batch spectators by row/colour or draw heads/bodies as a few rects each; measure the cost.
- The look stays consistent with the muted palette; no visual noise that makes the track hard to read.

- [ ] **Step 1: Failing test.** Add a test that the `finish` frame (`s = 1050`) contains more than 100 rects in spectator colours (the colours you use for outfits) than the `straight` frame at `s = 60` far from any venue, and that two frames at different `clock` values (`0` and `0.25`) differ in at least 20 spectator rects (the waving animation). Adapt the numbers to what you build, keeping the intent. Run it, see it fail.
- [ ] **Step 2: Implement and iterate on the pictures** (frames: the `ready` frame for the start stands, `finish`, a turn frame such as `s = 288` with the turn-3 group in view).
- [ ] **Step 3: Suite, cost, commit.** `npm test`; report the cost. Commit: `feat: add stands, waving spectators and advertising boards to the luge venue`.

---

### Task 6: Walls and ice

**Files:** `game/events/luge/lugeRender.js`, `game/events/luge/lugeProjection.js` only if a new constant is needed, tests in `tests/events/luge/lugeRender.test.js`.

**Acceptance:**
- The rim has a bright icy top lip (a few pixels of near-white with a thin highlight) and the inner wall is clearly darker and shaded by its slope, so the trough height and the walls are readable from behind the sled in the straight and the turns.
- On the outer side of every turn a low padding or snow bank (a dark-blue/grey padded strip or a soft snow bank) runs along the rim outside the lip.
- A subtle ice sheen: a lighter streak along each runner groove and a faint lighter gradient toward the horizon, with slight reflections (soft vertical highlights of the lamp poles and the signs) as far as they fit in the cost budget; the grooves stay visible.
- Nothing changes the gameplay reading: the racing line, the sled and the rim position stay as readable as before; the sled's contact with the rim in the crash frame looks right.

- [ ] **Step 1: Failing test.** Add a test that in the `hairpin` frame the padding/bank colours (those you introduce) appear (`> 300` rects) and that they do not appear in the `straight` frame at `s = 60` (no turns in view). Adapt to what you build. Run it, see it fail.
- [ ] **Step 2: Implement and iterate on the pictures** (frames: `hairpin`, `right turn`, `straight`, the crash frame at `lateral 1.3`).
- [ ] **Step 3: Suite, cost, commit.** `npm test`; report the cost. Commit: `feat: add icy rim lips, turn padding and an ice sheen to the luge track`.

---

### Task 7: Design document and final check

- [ ] **Step 1:** In `plans/2026-10-08-luge-design.md`, Presentation: describe the sky and mountains, the forest layers, the venue (stands, spectators, boards), the walls and the ice sheen, and the cost budget; in `plans/foundation-followups.md` keep or extend the "Luge graphics later rounds" line: speed feel (ice spray, speed lines), crash animation (rider flies off, ice debris, screen shake), snow cover and terrain detail, lighting and shadows, a nicer HUD.
- [ ] **Step 2:** Run `npm test`; commit `docs: describe the luge environment`.
