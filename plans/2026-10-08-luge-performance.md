# Luge: render performance in a real browser – Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a real Chrome canvas one luge frame costs about 37–55 ms (≈ 20–25 fps) although the no-op-context cost is only 3.5–5 ms. The cost is dominated by the number of `fillRect` calls (41 000–54 000 per frame, 13 000–25 000 of them 1×1) at about 1 µs each in the browser. Bring a frame below ≈ 16 ms (60 fps feel) in the same measurement, without changing the look.

**Facts (measured):**
- Real browser, hidden automation tab, NVIDIA T400 (accelerated canvas): frame cost with a real 640×512 canvas context, 40 frames then one readback: ready ≈ 37 ms, last push frames ≈ 55 ms, ride straight ≈ 40 ms, hairpin ≈ 40 ms, group frame ≈ 39 ms, finish ≈ 54 ms. Raw calibration: 40 000 `fillRect(…,1,1)` with two alternating colour strings ≈ 70–190 ms. So ≈ 1–5 µs per rect: **rect count is the lever**.
- Rect sources (from the final review, approximate, per frame): far forest backdrop ≈ 11 500 (`drawForestBackdrop` in `lugeForest.js`), sky ≈ 1 700 (`lugeSky.js`), the rider's `fillTaper` per-pixel fills 9 000–15 000 (`skeleton.js` `fillTaper`, called from `lugeSled.js`) plus `drawHelmet` per pixel, the track rows (≈ 300 rows × ≈ 27 segments), lines/venue/trees/HUD the rest. About 33 000 `fillStyle` changes per frame.

## Constraints

- The look must not change visibly (pixel-identical where possible; ≤ 0.5 % differing pixels and no visible change where a cache rounds positions). Game logic does not change. Tests must keep passing (the suite has 333 tests, none may be lost: read test files fresh, small targeted edits).
- No new packages, no image files. Offscreen caches are created in code (`OffscreenCanvas` or `document.createElement('canvas')`); the renderer must still work with the test `recordingCtx` (no canvas available): when no canvas factory exists it falls back to the current direct drawing, so all existing tests keep exercising the direct path.
- The shared engine used by the ski jump and slalom (`game/engine/skeleton.js` `fillCapsule`, `scenery.js`) must not change behaviour or rect structure (their tests count rects); add luge-only variants instead.
- A dev server serves this worktree to a human tester: keep every intermediate state working, do not start or stop servers.

## How to measure (use both)

1. **Rect count** with a counting fake context in node (count `fillRect` calls and `fillStyle` assignments per frame, attribute them to callers by wrapping the draw functions or by running the frame with parts disabled); frames: ready (`s = −3.4`), last push (`s = 15.5`, `showRedLine`), ride straight (`s = 60`), hairpin (`s = 662`, `lateral −0.5`, `curve 1`), group (`s = 288`), finish (`s = 1056`, phase `finished`).
2. **Real browser time**: the controller measures this in Chrome after each task (the Chrome extension tools are available to the controller, not necessarily to you). If you can use `mcp__claude-in-chrome__*` tools (load them with ToolSearch), you may measure yourself: open `http://127.0.0.1:8080/`, then in the page `const { renderLuge } = await import('/events/luge/lugeRender.js')`, create `document.createElement('canvas')` 640×512, render each frame type 60 times and force completion with one `ctx.getImageData(0,0,1,1)` at the end, and divide (keep each javascript call under ~30 s: too long calls time out). Otherwise report the rect counts and the controller measures.

## Task 1: Measure, then cut the rect count

**Files:** `game/events/luge/lugeForest.js`, `game/events/luge/lugeSky.js`, `game/events/luge/lugeRender.js`, `game/events/luge/lugeSled.js`, `game/engine/skeleton.js` (additions only), new `game/events/luge/lugeBackdrop.js` (cache), tests.

- [ ] **Step 1: Count.** Write the node counting harness (outside the repo or in `.superpowers/perf/`, git-ignored) and report the rect counts per frame type and per source. Decide the order of work from the numbers; work in descending order of saved rects.
- [ ] **Step 2: Rider and helmet runs.** Add a luge-only `fillTaperRuns` (or extend `fillTaper` carefully if `fillCapsule`'s rect structure is untouched) that merges consecutive pixels of the same colour in a row into one `fillRect(x, y, w, 1)`, and use it for the limbs and the helmet. The pixels drawn must be identical (add a test that renders a taper with `fillTaper` and with the run version into a pixel buffer and compares the buffers; also compare a full rider frame buffer before/after).
- [ ] **Step 3: Backdrop cache.** The sky gradient, the sun, the three mountain ridges, the haze and the far forest layers depend only on the heading shift (integer pixels) and, for the clouds only, on the clock. Pre-render each layer once into a wide strip canvas (wrap-around, or wide enough for the full range of the heading shift) at module load / first use and draw it per frame with `drawImage` at the current offset (a handful of `drawImage` calls instead of ≈ 13 000 rects). Clouds either as strips drifting with the clock or drawn directly if they are cheap. Keep the layer order and alpha exactly as today. Provide a graceful fallback to direct drawing when no canvas factory is available (tests with `recordingCtx`).
- [ ] **Step 4: Track and venue.** Re-count. If the track rows, trees, venue or lines still dominate, merge adjacent same-colour spans per row and avoid redundant `fillStyle` assignments (set `fillStyle` only when it changes within a row), reduce per-row segment count on rows far from the camera where colours change little, and look at the rect counts of the finish frame (the lines module is ≈ 42 % of its JS). Stop when frames are below the target or the remaining options would change the look.
- [ ] **Step 5: Verify.** Render the standard frames with the PNG harness (`.superpowers/shots/shots.mjs`, git-ignored) before/after and compare them: write the pixel-diff percentage per frame; open a few PNGs with the Read tool to confirm nothing visibly changed. Run `npm test` (count ≥ 333 plus new tests, none lost). Report the rect counts before/after per frame type and, if you could measure in Chrome, the real frame times.
- [ ] **Step 6: Commit** (one or a few commits): `perf: cut the luge draw calls with a cached backdrop and merged pixel runs`. Trailer with the model that did the work.

**Targets:** ≤ 15 000 `fillRect` calls per frame in every frame type, real-browser frame ≤ 16 ms (≤ 25 ms acceptable if the remaining cost is in the track rows and a second pass is planned).
