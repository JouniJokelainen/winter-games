# Luge graphics: smooth start, hop and finish lines – Design and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playtest feedback: the start line, the red hop line and the finish line look too pixelated. Draw them as smooth lines that follow the U-shaped trough, with soft edges, and make their shapes clearer. Game logic does not change.

**Why they look rough now (facts):** in `drawRows` (`game/events/luge/lugeRender.js`) the cross-section of the track is split into 24 segments per screen row (`SAMPLE_XS`); the hop band, the finish checker (and, drawn separately, the start line) take their colour per segment, so their edges are stepped by the segment boundaries and by 1-px rows, and at a distance they break into pieces. The start line (`drawStartLine`) is already a continuous 2 px curve sampled from the trough profile, but it is thin and not in the same style.

## Decisions (user-approved)

1. **Fine drawing for the lines:** draw the hop band, the start line and the finish checker as a separate overlay pass over the ice. For every screen row that the line touches, work per pixel column: invert the cross-section projection (the `points` of the row give screen x for each trough position x; interpolate between them) to get the exact trough position `x` and the exact distance `along` of every pixel, so the line follows the U-shape as a smooth curve and its edges are exact.
2. **Soft edges:** edge pixels are drawn with partial coverage using translucent fills (`rgba(...)` colour strings, as the sky already does; coordinates stay whole pixels), so the stair steps soften. No image files.
3. **Clearer shapes:** (a) finish: a two-row black-and-white chequered strip across the whole ice width (square size ≈ 0.4 m, true perspective, squares alternate across and between the two rows), (b) hop line: the wide red band with white edges as before (≈ 0.5 m long, perspective-stable minimum width so it stays readable at 20 m, `max(0.45, 0.08·z)` half-length as today) drawn smooth, (c) start line: white band ≈ 0.12 m long (≥ 2 px), the same smooth drawing and the same off-white as the hop band's edges.
4. The lines must not be overpainted by the groove sheen, the racing line or the rider shadow in a way that breaks them; they keep the fog tint of the ice (use the same tint function as the ice spans) so they recede with distance; the rims and the walls stay free of lines (lines are limited to the ice between the rims).

## Global Constraints

- Code, identifiers and comments in English. No new packages, images or fonts. Commit trailer names the model that did the work.
- Rects whole pixels, no old retro colours (`yellow`, `ice`, `blue`, `navy`, `pine`, `brown`); translucent colour strings are fine.
- Game logic does not change. Existing tests keep passing (the suite has 326+ tests; none may be lost: read files fresh before editing and use small targeted replacements).
- The ride-frame cost with a no-op context must stay below about 5 ms (it is ≈ 3.5–4.2 ms now). The overlay must only touch rows where a line exists, and only while the line is on screen.
- A dev server serves this worktree to a human tester: keep every intermediate state of the files working, do not start or stop servers.
- Visual work is judged by looking: use the PNG harness `.superpowers/shots/shots.mjs` (extend it; git-ignored), open PNGs with the Read tool and iterate. Render BEFORE frames first (`before-lines-*.png`), final ones as `after-lines-*.png`, plus 3× nearest-neighbour crops of each line.

## Frames to render

ready (push start, `s = −3.4`, `showRedLine: true`), `s = 4` (push), the hop line 18 m ahead (`s = 2`), a mid-distance frame for each line, the finish at several distances (`s = 1000, 1030, 1045, 1054, 1058`), and the finish frame `s = 1056` with the groove sheen present.

---

### Task 1: Smooth lines

**Files:** `game/events/luge/lugeRender.js` (or a new `game/events/luge/lugeLines.js` if it keeps lugeRender.js clearer), tests in `tests/events/luge/lugeRender.test.js`.

**Acceptance (judge in the PNGs, compare with the BEFORE frames):**
- The hop band, the start line and the finish checker are smooth continuous curves following the trough (no 24-segment stair steps), with soft edge pixels; no broken pieces at a distance (the hop band at 20 m is one connected band; the finish checker is connected across the whole ice width).
- Finish: two rows of squares in true perspective; recognisable as a chequered line at 10–30 m and when passing it; no checker on the rims; the gantry banner above is unchanged.
- Start and hop lines keep their meaning: white start line, red hop band with white edges; the hop line is drawn only while `showRedLine` is true, the start line only in the start frames as today.
- The groove sheen, the racing line and the shadow do not break the lines (the finish and hop pixels at the grooves keep their colours).
- No new visual noise; the other parts of the frames are pixel-identical to before except where the lines are.

- [ ] **Step 1: Failing tests.** In `tests/events/luge/lugeRender.test.js` add tests (adapt thresholds to what you build, keep the intent, make sure each fails on the old code): (a) *connected finish checker*: render `s = 1046` and, for the rows where black/paper checker squares exist, assert that the checker spans a continuous x range from near the left rim to near the right rim (no gap longer than a few pixels in the sequence of checker rects of a row, ignoring the alternation between black and paper); (b) *smooth edges*: the line frames contain translucent edge colours (`rgba(` strings) on the rows of each line, and the count of distinct x start positions between consecutive rows of the hop band changes by at most 3 px per row (a smooth curve, not 24-segment steps) on the rows where the band is wider than 3 rows; (c) *no overpaint*: with the groove sheen present the checker/hop rects at the groove x keep their colours; (d) whole pixels and no retro colours for all the frames of the plan, rims free of line colours (no paper/black checker rects outside the rim span).
- [ ] **Step 2: Run them to verify they fail**, then implement the overlay pass, then iterate on the pictures until the acceptance list is met.
- [ ] **Step 3: Suite, cost, commit.** `npm test` (count >= before, none lost); report the no-op ride-frame cost (50 calls) before/after and the PNG paths. Commit: `feat: draw the luge start, hop and finish lines as smooth soft-edged lines`.
