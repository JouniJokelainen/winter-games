# Luge graphics: a smooth ice surface – Design and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playtest feedback: the track looks like many grey lengthwise stripes of different tones. Make the ice surface smooth and continuous, with a hint of real ice. Game logic does not change.

**Why it looks striped (facts):** `drawRows` in `game/events/luge/lugeRender.js` projects the trough cross-section into 25–27 sample points per screen row and fills each segment between two samples with ONE flat colour (`iceColor(slope, depth, band)`, cached with coarsely quantised keys: `round(slope·20)`, `round(depth·12)`). Segment borders are lines of constant trough position, so they converge toward the horizon as lengthwise stripes, and neighbouring tones differ in visible steps. Alternating transversal bands (`floor(along/5) % 2`, +7 % white) have hard borders. The two hairline grooves (1 px `trackGroove`) and the sheen streaks add more lengthwise lines. The track rows are now painted into an `ImageData` row buffer (`game/events/luge/lugeRowBuffer.js`, one `putImageData`), so per-pixel colour work is cheap and the ice can be computed per pixel column.

## Decisions (user-approved, from the design interview)

1. **Surface:** a soft, continuous shading across the trough as the base, plus a very restrained ice texture on top (faint scratches and wear marks), so the ice reads as ice and not as flat paint.
2. **Style:** really smooth: many tones with soft transitions, no visible steps (like the lines and the sky are already smooth).
3. **Budget:** at most about +1.5 ms per frame in real Chrome (the ride frame is ≈ 6.5–7 ms now; heaviest frames ≈ 12 ms). If the budget is exceeded, make far rows (where tones change little) coarser.
4. **Transversal bands** (every 5 m): keep, but soft: a smooth sine-like blend with a very small contrast instead of the hard on/off.
5. **Grooves and sheen:** replace the 1 px hairlines and the sheen streaks by wide, dim wear marks (soft lighter or darker lanes along the runner paths) that give a direction but do not look like lines.
6. **Light:** the direction stays (lit from the right: the left wall bright, the right wall dark), with a smooth transition.

## Global Constraints

- Code, identifiers and comments in English. No new packages, images or fonts.
- Rects/pixels: colours come from the existing palette family (blend with `mix` caches or per-pixel interpolation of RGB triples); no old retro colours (`yellow`, `ice`, `blue`, `navy`, `pine`, `brown`) in the output.
- Game logic does not change; the racing line, hop line, start line, finish checker (lugeLines.js), the rim lip, the wall shading and padding, the objects and the sled keep their look and stay readable on the new surface. The existing tests must keep passing (the suite has 340 tests; none may be lost: read test files fresh, small targeted edits).
- The renderer must keep working with the test `recordingCtx` (no ImageData): keep the existing fallback path structure (the direct path may use per-segment colours with finer interpolation, or the same shading function evaluated per segment; tests with `recordingCtx` assert whole pixels and no retro colours).
- Performance: in real Chrome (measure as below) the ride frame may grow by at most ≈ 1.5 ms; do not increase the number of `fillRect` calls per frame by more than a few hundred.
- A dev server serves this worktree to a human tester: keep every intermediate state working, do not start or stop servers.
- Visual work is judged by looking: use the PNG harness `.superpowers/shots/shots.mjs` (git-ignored; extend it), render BEFORE frames first (`before-surface-*.png`), then AFTER (`after-surface-*.png`) plus 2× nearest-neighbour crops of the track in the straight and in the turns; open them with the Read tool and iterate.
- Measure real browser time: if the Chrome tools (`mcp__claude-in-chrome__*`, load via ToolSearch) are available, open `http://127.0.0.1:8080/`, then in the page `const { renderLuge } = await import('/events/luge/lugeRender.js?v=' + Date.now())`, render each frame type 40 times into a `document.createElement('canvas')` 640×512 context and force completion with one `ctx.getImageData(0,0,1,1)` after the batch (keep each call under ~30 s). Reference (current): ready 11.4, last push 12.7, straight 7.0, hairpin 6.7, group 6.5, finish 11.8 ms. Otherwise report no-op-context costs and the controller measures.

## Frames to render

ready (`s = −3.4`, push, `showRedLine`), straight (`s = 60`), right turn (`s = 108`, `curve 1`), hairpin (`s = 662`, `lateral −0.5`), left turn (`s = 412`), the long straight `s = 560` and `s = 1000`, finish (`s = 1056`, phase `finished`), crash at the rim (`lateral 1.3`, sparks).

---

### Task 1: Smooth ice

**Files:** `game/events/luge/lugeRender.js` (the row loop and `iceColor`/`computeIce`), `game/events/luge/lugeRowBuffer.js` if the buffer API needs per-pixel writes, tests in `tests/events/luge/lugeRender.test.js`; a new `game/events/luge/lugeIce.js` for the shading/texture functions if that keeps `lugeRender.js` clearer.

**Acceptance (judge in the PNGs, compare with the BEFORE frames):**
- No visible lengthwise stripes or tone steps across the trough: the shading across the width is a smooth gradient (bright left wall → bright centre → darker right wall) with soft bank/curve-dependent changes; the 25-segment structure is not visible.
- A restrained, believable ice texture: faint scratches/wear marks along the track and subtle noise; deterministic (a hash of the position along the track and the trough position, no `Math.random`), stable between frames at the same position, and they do not shimmer visibly when the camera moves (the texture sticks to the track).
- The transversal bands are soft; the grooves and sheen are wide, dim lanes (no hairlines); the sled shadow, racing line, lines module, rims, walls and padding remain as before and stay readable; the horizon fog still lightens the distance.
- Far rows: smooth too (no moiré or flicker from the texture at distance: fade the texture out with distance and keep the base gradient).
- No more than ≈ +1.5 ms in real Chrome; no meaningful increase in `fillRect` calls.

- [ ] **Step 1: Failing tests.** In `tests/events/luge/lugeRender.test.js` (read it fresh) add tests; adapt thresholds to what you build, keep the intent, make sure each fails on the old code: (a) *smooth across the width*: render the straight frame into a pixel buffer (the test suite already has helpers that rasterise `recordingCtx` rects; write a small helper if needed) and, along a row in the middle of the track (e.g. y = 400), assert that the colour difference between horizontally neighbouring pixels on the ice never exceeds a small threshold (no steps), except at the rim, groove-free; (b) *deterministic and stable*: two renders of the same view are identical, and shifting `s` by exactly one band period (10 m) gives an identical track region (the texture is a function of the position along the track); (c) *no hairline grooves*: no 1 px wide lengthwise dark run inside the ice in the straight frame; (d) whole pixels and no retro colours for all frames of the plan.
- [ ] **Step 2: Run them to verify they fail**, implement, iterate on the pictures until the acceptance list is met.
- [ ] **Step 3: Suite, cost, commit.** `npm test` (count ≥ 340 plus new tests, none lost); report the real-Chrome frame times before/after (or the no-op costs) and the PNG paths. Commit: `feat: give the luge track a smooth ice surface with a restrained texture`. Trailer with the model that did the work.
