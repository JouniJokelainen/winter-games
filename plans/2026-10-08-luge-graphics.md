# Luge graphics: a realistic rider and a readable start – Design and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the luge graphics where the playtest found the weakest spots: the rider and runner figure (now "a pile of round blobs") and the start line (now a faint red dashed line). Same realistic muted style as the rest of the game, drawn entirely in code. Game logic does not change.

**Architecture:** A pure pose module (`lugePose.js`) describes the figure as an articulated skeleton (run cycle, hop to the sled, lying pose, lean in turns); `lugeSled.js` draws it with tapered limbs and layered shading; `lugeScene.js` feeds two new view fields (`hop`, `curve`); the renderer gets a wide painted red hop line, white start line, flags and start barriers.

**Tech Stack:** Plain ES modules, `node --test`, canvas 2D rects at 640×512. No images, fonts or packages.

## Decisions from the design interview (user-approved)

1. Scope: ohjaskelkkailu only. Focus: the figures (runner in the push phase, rider lying on the sled) and the start line. Other events, menus and result screens are not touched.
2. Both figures are rebuilt with the same look so the runner and the hopping rider are clearly the same person.
3. "More realistic": real proportions (broad shoulders, narrower waist, a visible neck, helmet), an aerodynamic suit with seams and stripes, helmet with visor, gloves, spiked shoes, soft shading from a light source up-left (≥ 3 tones per surface plus a rim highlight). Colours stay those of `SKIER_STYLES.classic` (red helmet, blue suit, white back/bib) so all events match.
4. Animation: a smooth run cycle (arm and leg swing, torso lean growing with speed), a ≈ 0.3 s hop onto the sled at the red line, the rider leaning into turns (torso roll and head tilt toward the inside). The crash animation is a later round.
5. Size: the sled and rider keep their `SCALE = 1.2` drawing size.
6. Red hop line: a wide, bright painted band (≈ 0.5 m along the track, white edges) plus small red flags on both rims at the line; no gate (it would hide the rider).
7. Start: a white start line and low start barriers beside the track, behind the runner. (The camera cannot see anything closer than 2.3 m: place the line and barriers so that they are visible in the ready frame near the bottom of the screen.)
8. Limits: no image files or packages; the luge draw cost stays well below 8 ms per frame (the drawing logic cost today is ≈ 3 ms with a no-op context).
9. Verification: before/after PNGs of every change (from the harness in `.superpowers/shots/`, git-ignored), then the user plays and approves.

## Global Constraints

- Code, identifiers and comments in English; on-screen texts Finnish upper case.
- No new packages, no image files, no fonts. Commit messages end with the attribution line given in each task.
- Renderer rects must be whole pixels and must not use the old retro colours (`yellow`, `ice`, `blue`, `navy`, `pine`, `brown`).
- The simulation, scoring, controls and the balance of the bot tests do not change. Existing tests must keep passing.
- Work in `.worktrees/luge` (branch `feature/luge`). A dev server is running from this worktree for the user's playtest: do not start or stop servers.
- Visual work is judged by looking: every task renders PNGs with `.superpowers/shots/shots.mjs` (extend it, do not commit it: `.superpowers/` is git-ignored), opens them with the Read tool and iterates until the acceptance list of the task is met. Keep the BEFORE frames: copy the current `.superpowers/shots/*.png` to `.superpowers/shots/before/` before changing any drawing code (skip if the folder already exists).

---

### Task 1: Pose module, tapered limbs, the new runner and rider

**Files:**
- Create: `game/events/luge/lugePose.js`
- Modify: `game/engine/skeleton.js` (add `fillTaper`), `game/events/luge/lugeSled.js`, `game/events/luge/lugeRender.js`, `game/events/luge/lugeScene.js`
- Test: `tests/events/luge/lugePose.test.js` (new), `tests/engine/skeleton.test.js`, `tests/events/luge/lugeRender.test.js`, `tests/events/luge/lugeScene.test.js`

**Interfaces:**
- Produces (`game/engine/skeleton.js`): `fillTaper(ctx, ax, ay, bx, by, radiusA, radiusB, colorAt)` — like `fillCapsule` but the radius changes linearly from `radiusA` at `a` to `radiusB` at `b` (round end caps of those radii); `colorAt(across, t)` as in `fillCapsule`; only whole-pixel `fillRect(x, y, 1, 1)` calls.
- Produces (`lugePose.js`, pure, no canvas): `HOP_SECONDS = 0.3`; `runPose(phase, speed01)`, `liePose(curve)`, `hopPose(t, curve)`. A pose is an object of named joint points in sled-local metres `{ x: right, h: up from the deck, z: forward along the sled, 0 = rear end of the deck }` with at least `hip, neck, head, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR, kneeL, kneeR, ankleL, ankleR, toeL, toeR` and a `headTilt` number (radians). `phase ∈ [0,1)` is the stride phase, `speed01 ∈ [0,1]` the push speed share (more forward lean when higher), `curve ∈ [-1,1]` the normalised curvature (+ right turn), `t ∈ [0,1]` the hop progress. Properties the tests pin down (see Step 1): periodicity, constant bone lengths (±5 %), `hopPose(0) ≈ runPose(HOP_RUN_PHASE, 1)`, `hopPose(1) ≈ liePose(curve)`, the lying pose lies on the deck (all `h` ≥ 0 and small) and is left/right symmetric when `curve = 0`. Export `HOP_RUN_PHASE` (the stride phase the hop starts from).
- Produces (scene → renderer view fields): `hop` (`undefined` or a number in 0…1: 0 at the red line, 1 when the rider lies on the sled), `curve` (−1…1, the track curvature at the sled divided by `kMax`, clamped). `LugeScene#hopProgress()` returns the progress 0…1 (1 when no hop is active). The scene sets `this.hopClock = 0` when the `hop` event is seen and advances it with `dt`.
- Consumes: `project`, `profileHeight`, `profileSlope`, `SLED_Z` (`lugeProjection.js`), `SKIER_STYLES.classic` (`../skiJump/skier.js`), `shaded`, `solid`, `fillCapsule` (`skeleton.js`).

**What the figure must look like (acceptance list; judge it in the PNGs):**
- Seen from behind and above it reads as a person, not as blobs: distinct helmet (red shell with a highlight stripe and a visor edge, a neck gap), shoulders broader than the waist, a visible spine seam and side seams on the suit, a white back panel with a bib number, forearms and gloves gripping the sled, legs with knee and calf shape, spiked shoes with visible soles when the feet trail behind.
- Limbs are tapered (thicker at the shoulder/hip, thinner at the wrist/ankle), joints are rounded, there is at least a light/base/dark tone per surface and a thin rim highlight on the lit side, plus a soft shadow of the rider on the deck.
- Runner (push phase): bent forward ≈ 35° at the hip (more at higher `speed01`), arms reaching the rear handles of the sled, legs in a real stride (one planted, one kicked back with the heel up), the head up, spikes on the shoes; the 4 frames at stride 0, 0.25, 0.5, 0.75 look like one continuous run cycle.
- Hop frames at t = 0, 0.25, 0.5, 0.75, 1 form a believable arc from the running pose to lying on the sled (hips lift to ≈ 0.5 m, the torso rotates from leaning to horizontal, the legs trail back).
- Lean: at `curve = ±1` the shoulders roll ≈ 6° and the head tilts toward the inside of the turn, clearly visible next to `curve = 0` but not cartoonish.
- Same colours as `SKIER_STYLES.classic`.
- Cost: the luge `renderLuge` ride frame must not become more than ≈ 1 ms slower than before (measure with a no-op context over 50 calls as in the earlier fact-finding: ≈ 3.0 ms before).

- [ ] **Step 1: Failing tests**

Write the tests first.

`tests/engine/skeleton.test.js` — add (read the existing file for its style and the recording-context helper): `fillTaper` draws only whole-pixel 1×1 rects, the covered width near `a` is larger than near `b` when `radiusA > radiusB`, and a taper with equal radii covers the same pixels as `fillCapsule`.

`tests/events/luge/lugePose.test.js` — new, pure:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOP_RUN_PHASE, HOP_SECONDS, hopPose, liePose, runPose } from '../../../game/events/luge/lugePose.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.h - b.h, a.z - b.z);
const BONES = [['hip', 'kneeL'], ['kneeL', 'ankleL'], ['hip', 'kneeR'], ['kneeR', 'ankleR'], ['shoulderL', 'elbowL'], ['elbowL', 'wristL'], ['shoulderR', 'elbowR'], ['elbowR', 'wristR']];
const close = (a, b, eps = 1e-6) => Object.keys(a).every((key) => (typeof a[key] === 'number' ? Math.abs(a[key] - b[key]) < eps : close(a[key], b[key], eps)));

test('the hop lasts 0.3 s', () => assert.equal(HOP_SECONDS, 0.3));

test('the run cycle is periodic and every joint is a finite number', () => {
  assert.ok(close(runPose(0, 1), runPose(1, 1), 1e-6));
  for (let i = 0; i < 20; i++) {
    const pose = runPose(i / 20, i / 19);
    for (const point of Object.values(pose)) if (typeof point === 'object') assert.ok([point.x, point.h, point.z].every(Number.isFinite));
  }
});

test('bone lengths stay constant (±5 %) through the run cycle, the hop and in the lying pose', () => {
  const lengths = (pose) => BONES.map(([a, b]) => dist(pose[a], pose[b]));
  const base = lengths(runPose(0, 0.5));
  const poses = [];
  for (let i = 0; i < 16; i++) poses.push(runPose(i / 16, 0.5));
  for (let i = 0; i <= 10; i++) poses.push(hopPose(i / 10, 0.3));
  poses.push(liePose(0), liePose(1), liePose(-1));
  for (const pose of poses) lengths(pose).forEach((length, i) => assert.ok(Math.abs(length / base[i] - 1) < 0.05, `bone ${BONES[i]} ${length} vs ${base[i]}`));
});

test('the hop starts from the running pose and ends in the lying pose', () => {
  assert.ok(close(hopPose(0, 0.4), runPose(HOP_RUN_PHASE, 1), 1e-6));
  assert.ok(close(hopPose(1, 0.4), liePose(0.4), 1e-6));
});

test('the hop lifts the hips above both the running and the lying height in the middle', () => {
  const mid = hopPose(0.5, 0).hip.h;
  assert.ok(mid > hopPose(0, 0).hip.h && mid > hopPose(1, 0).hip.h);
});

test('the lying pose lies on the deck and is symmetric without lean; leaning tilts the head toward the inside', () => {
  const pose = liePose(0);
  for (const point of Object.values(pose)) if (typeof point === 'object') assert.ok(point.h >= 0 && point.h < 0.7);
  assert.ok(Math.abs(pose.shoulderL.h - pose.shoulderR.h) < 1e-9);
  assert.ok(Math.abs(pose.shoulderL.x + pose.shoulderR.x) < 1e-9);
  assert.ok(liePose(1).headTilt > liePose(0).headTilt && liePose(-1).headTilt < liePose(0).headTilt);
});
```
(If a property cannot hold for a reasonable pose model, adjust the tolerance with a comment explaining why, not the intent.)

`tests/events/luge/lugeScene.test.js` — add: after the scene sees the `hop` event (drive a scene with the good bot until `state.phase === 'running'`, or set `scene.hopClock` directly) `hopProgress()` goes 0 → 0.5 at 0.15 s → 1 at 0.3 s and stays 1; `hopProgress()` is 1 when no hop happened; the render view gets `curve` equal to the clamped `curvatureAt(state.s) / kMax` (check through a spy on the recording ctx is not needed: export a small pure helper `curveOf(s)` from `lugeScene.js` and test it: 0 on the straight, +1 inside the tightest right turn, −1 inside a left turn of the same size, within ±1 always).

`tests/events/luge/lugeRender.test.js` — add frames for the push (stride 0, 0.25, 0.5, 0.75 with `speedKmh`), hop (`hop` 0, 0.25, 0.5, 0.75, 1), and lean (`curve` −1, 0, 1): all draw whole pixels, avoid the retro colours, and every frame draws more than 2000 rects.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/engine tests/events/luge`
Expected: FAIL (module `lugePose.js`, `fillTaper`, `hopProgress`, `curveOf` missing).

- [ ] **Step 3: `fillTaper` and the pose module**

Implement `fillTaper` in `game/engine/skeleton.js` (same loop as `fillCapsule`, radius `ra + (rb − ra) · t` where `t` is the clamped projection of the pixel on the segment; keep the `across` and colour callback contract). Implement `lugePose.js`: an articulated model with fixed bone lengths for a 1.8 m athlete scaled to the sled (upper leg 0.45, lower leg 0.45, upper arm 0.3, forearm 0.28, torso 0.55, neck 0.1), a run cycle by forward kinematics from joint angles (sine-based stride with hip, knee and ankle angles; arms counter-swinging; torso lean from `speed01`), `liePose(curve)` (prone, head toward +z, legs trailing at z < 0, hands on the front handles, lean tilting the shoulder line and `headTilt`), and `hopPose(t, curve)` that interpolates the joint angles (not the joint positions, so the bones keep their length) from `runPose(HOP_RUN_PHASE, 1)` to `liePose(curve)` along an arc that lifts the hips. Document the model in a short header comment.

- [ ] **Step 4: Drawing (`lugeSled.js`, `lugeRender.js`)**

Rewrite the rider/runner drawing in `lugeSled.js` with the poses: draw order far → near with a soft shadow on the deck first, legs, torso (back panel, spine seam, side seams, bib number), arms and gloves, neck, helmet (shell, highlight, visor edge, chin strap detail as far as visible); use `fillTaper` for limbs, three tones per surface and a rim highlight on the lit (up-left) side. Keep the sled drawing (runners, deck, rails) and the placer logic (`makePlacer`: roll with the wall) but you may add detail to the sled (rail shading, steering handles). Keep `drawSledAndRider(ctx, look, view)` and `drawRunner(ctx, look, view, stride)` as the entry points used by `renderLuge`, with these rules: in the push phase `drawRunner` uses `runPose(stride, speed01)` where `speed01 = clamp(view.speedKmh / 3.6 / 8, 0, 1)` (8 m/s is the maximum push speed); when `view.hop` is a number below 1 the rider is drawn with `hopPose(view.hop, view.curve ?? 0)`; otherwise the rider is drawn with `liePose(view.curve ?? 0)`. `renderLuge` passes `view` through unchanged (add nothing but what is needed for the hop: the runner must also be drawn while `view.hop < 1`, as the hopping rider).

- [ ] **Step 5: Scene**

In `lugeScene.js`: add `this.hopClock = null` in the constructor; in `update` set `this.hopClock = 0` when a `hop` event is in `state.events`, and advance it (`+= dt`) every update while it is a number and below `HOP_SECONDS`; add `hopProgress()` (returns 1 when `hopClock` is `null`, else `min(1, hopClock / HOP_SECONDS)`); export `curveOf(s)` = `clamp(curvatureAt(s) / LUGE_CONFIG.kMax, -1, 1)`; add `hop: this.hopClock === null ? undefined : this.hopProgress()` and `curve: curveOf(state.s)` to the render view. The `push` phase view must keep `phase: 'push'` as today; the hop happens in the `ride` phase.

- [ ] **Step 6: Iterate on the pictures**

Extend `.superpowers/shots/shots.mjs` (the PNG harness, git-ignored) with the frames: push at stride 0 / 0.25 / 0.5 / 0.75 (`speedKmh` 0 and 28), hop at 0 / 0.25 / 0.5 / 0.75 / 1, ride straight, ride in a right and a left turn with `curve` ±1 (and `lateral` on the outer side), crash tilted at the rim. Render, open every PNG with the Read tool, compare with the BEFORE frames and iterate on the drawing until every point of the acceptance list above is met. Save the final frames as `.superpowers/shots/after-task1-*.png`. Then run `node --test tests/events/luge`, `npm test`.

- [ ] **Step 7: Cost check and commit**

Measure the `renderLuge` ride-frame cost with a no-op context (50 calls, ms); it must stay within ≈ 1 ms of the earlier ≈ 3.0 ms. Report both numbers. Commit with the attribution line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (or the model that did the work):

```bash
git add game tests
git commit -m "feat: draw a realistic runner and rider for the luge with a run cycle, hop and lean"
```

---

### Task 2: Red hop line, start line, flags and start barriers

**Files:**
- Modify: `game/events/luge/lugeRender.js`
- Test: `tests/events/luge/lugeRender.test.js`

**Interfaces:**
- Consumes: `RED_LINE_S` from `lugeTrack.js`; the render view field `showRedLine` (shown during the push phase) stays as it is.
- Produces: a start area drawn by the renderer: nothing new in the view contract.

**What it must look like (acceptance list):**
- The hop line is a wide, bright red band across the whole ice (not over the rims), ≈ 0.5 m long along the track with ≈ 0.08 m white edges, readable from the start (20 m ahead) in the push frame; it stays drawn only while `showRedLine` is true.
- Small red flags (a thin pole ≈ 1.2 m high with a pennant) stand on both rims at `RED_LINE_S` (always drawn, they are scenery).
- A white start line ≈ 0.3 m wide across the ice and low start barriers (≈ 0.6 m high, ≈ 1.2 m long, wooden or concrete, with a darker top edge) on both rims, behind the runner. Remember that the camera sees nothing closer than 2.3 m (rows below the screen) and objects with `along − s ≤ 2.3` are filtered out by `buildScenery`: choose the positions so that in the ready frame (`s = −3.4`) the start line and the barriers are visible near the bottom of the screen, behind the runner; report the positions you chose.
- Everything uses the fog tint like the other objects and stays whole-pixel, with no retro colours, and the existing frames (ride, crash, finish) keep their look.

- [ ] **Step 1: Failing tests**

In `tests/events/luge/lugeRender.test.js` add: (a) in the push frame (`s: -3.4`, `showRedLine: true`) the number of `PALETTE.red` rects is larger than before the change (record the baseline number before the change in a comment, or compare with the frame rendered with `showRedLine: false`: more than 150 more red rects with the line on), (b) white (`PALETTE.paper`) pixels of the start line appear in the push frame at its rows (assert that a frame at `s = -3.4` contains a `PALETTE.paper` rect row wider than 100 px below y = 400 that a frame at `s = 300` does not), (c) at `s = RED_LINE_S - 18` (the line is about 18 m ahead) with `showRedLine: false` the red flags are visible: more `PALETTE.red` rects than in a frame at `s = 300`... If a test idea does not fit what you built, replace it with an equivalent assertion that proves the feature is drawn and keep whole-pixel and retro-colour checks for all frames.

- [ ] **Step 2: Run to verify they fail, implement, iterate on the pictures**

Run `node --test tests/events/luge` (expect FAIL). Implement in `lugeRender.js`: the red band and white edges in the segment-colour code that currently paints the thin red line (search for `showRedLine`), the white start line the same way, the flag and barrier objects in `buildScenery` / `drawObject` (new object types), at the positions required above. Extend `.superpowers/shots/shots.mjs` with the push frame at `s = −3.4` and at `s = 4` (the runner has advanced), a frame 18 m before the red line, and the same frames with `showRedLine: false`; render, open the PNGs with the Read tool, compare with the BEFORE frames and iterate until the acceptance list is met. Save the final frames as `.superpowers/shots/after-task2-*.png`.

- [ ] **Step 3: Full suite and commit**

Run: `npm test` (all pass). Measure the ride-frame render cost again (it must stay within ≈ 1 ms of the figure from Task 1). Commit:

```bash
git add game tests
git commit -m "feat: paint a wide red hop line, flags, a start line and barriers on the luge track"
```
(with the attribution line of the model that did the work).

---

### Task 3: Design document, follow-ups and final check

**Files:** `plans/2026-10-08-luge-design.md`, `plans/foundation-followups.md`

- [ ] **Step 1: Document**

In `plans/2026-10-08-luge-design.md`, Presentation: describe the new rider/runner (articulated pose model, run cycle, hop 0.3 s, lean), the red hop line with flags and the start line with barriers; add the testing line (pose tests, render frames). In `plans/foundation-followups.md` add under "Any time": "Luge graphics later rounds: crash animation (rider flies off, ice spray, screen shake), a livelier crowd and stands, a better ice surface (shine, reflections), more detailed sky and forest, a nicer HUD."

- [ ] **Step 2: Full suite and commit**

Run `npm test`. Commit: `git add plans && git commit -m "docs: describe the luge rider, hop line and start area"`.
