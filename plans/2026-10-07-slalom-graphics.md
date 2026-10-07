# Slalom Graphics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw the slalom at the full 640×512 canvas in the realistic muted style: groomed slope, net fences, pines and spectators, gates with shadows, a wooden start hut, a concrete finish, and a front-view skeleton skier in style C — without changing gameplay.

**Architecture:** The ski jumper's capsule rasteriser moves unchanged to `game/engine/skeleton.js` (ski jump fingerprint verified). A new `slalomSkier.js` builds a front-view skier from it. `slalomRender.js` is rewritten to draw in canvas pixels with world coordinates ×2; `SlalomScene` sets `highResolution = true`. Simulation, course, scoring and controls are untouched.

**Tech Stack:** Plain JS ES modules, Canvas 2D (`fillRect` only), `node:test`.

**Design:** `plans/2026-10-07-slalom-graphics-design.md`. Product rules: `docs/spec.md` ("Pujottelu").

## Global Constraints

- No npm dependencies; Node built-ins only. Never run `npm install`.
- All code, identifiers, comments and commit messages in English. All player-visible text in Finnish, UPPERCASE; slalom texts do not change.
- Never store API keys or tokens in code or files.
- Canvas 640×512 (`CANVAS_WIDTH`, `CANVAS_HEIGHT`); a scene with `highResolution = true` draws 1:1. All graphics drawn in code with `ctx.fillRect` (no image files, no paths/arcs).
- Fixed update step 1/60 s; timing uses only `dt` (never `performance.now()`).
- Gameplay must not change: `game/events/slalom/slalomSim.js`, `game/events/slalom/course.js`, scoring, controls, sounds, and their tests stay untouched.
- The ski jump must look exactly as before (same rects, same order, same colours).
- Tests: `npm test` (= `node --test tests/`), files `tests/**/*.test.js`.
- Browser checks use `npm run dev` (no results are committed or pushed).
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

```
game/engine/skeleton.js                   CREATE: capsule rasteriser shared by both skiers
game/events/skiJump/skier.js              MODIFY: import the rasteriser from skeleton.js
game/events/slalom/slalomSkier.js         CREATE: front-view slalom skier
game/events/slalom/slalomRender.js        REWRITE: 640×512 slalom scene
game/events/slalom/slalomScene.js         MODIFY: highResolution = true
tests/engine/skeleton.test.js             CREATE
tests/events/slalom/slalomSkier.test.js   CREATE
tests/events/slalom/slalomRender.test.js  REWRITE
tests/events/slalom/slalomScene.test.js   MODIFY: highResolution test
```

---

### Task 1: Shared skeleton rasteriser

**Files:**
- Create: `game/engine/skeleton.js`, `tests/engine/skeleton.test.js`
- Modify: `game/events/skiJump/skier.js`

**Interfaces:**
- Produces (`game/engine/skeleton.js`), moved unchanged from `skier.js` and now exported:
  - `fillCapsule(ctx, ax, ay, bx, by, radius, colorAt)` — fills every whole pixel within `radius` of segment a→b; `colorAt(across, t)` picks each pixel's colour
  - `solid(color)` → `() => color`
  - `shaded(light, dark, split = 0.35)` → `(across) => (across > split ? dark : light)`
  - `transform(x, y, angle, [lx, ly])` → `[sx, sy]`: local point (x right, y up) rotated counter-clockwise by `angle` and placed at screen (x, y)

- [ ] **Step 1: Record the ski jump fingerprint before touching anything**

Run from the repo root (Git Bash):

```bash
node --input-type=module -e "
import { createHash } from 'node:crypto';
import { HILL } from './game/events/skiJump/hill.js';
import { renderSkiJump } from './game/events/skiJump/skiJumpRender.js';
import { createJumpState } from './game/events/skiJump/skiJumpSim.js';
const rects = [];
const ctx = { fillStyle: null, fillRect(x, y, w, h) { rects.push([x, y, w, h, this.fillStyle]); } };
const s = createJumpState(HILL, { wind: 2 });
for (const st of [
  s,
  { ...s, phase: 'flight', x: 60, y: -20, speed: 26, angle: 0.8, lipTime: 4, time: 5 },
  { ...s, phase: 'landed', x: 180, y: -100, speed: 20, distance: 180, landing: 'perfect', lipTime: 4, time: 10 },
]) {
  renderSkiJump(ctx, { state: st, label: 'X', time: 1.3 });
}
console.log(rects.length, createHash('sha256').update(JSON.stringify(rects)).digest('hex'));
"
```

Write the printed line into your report as the BEFORE fingerprint.

- [ ] **Step 2: Write the failing test**

`tests/engine/skeleton.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillCapsule, shaded, solid, transform } from '../../game/engine/skeleton.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

test('fillCapsule rasterises a disc as whole pixels in the chosen colour', () => {
  const ctx = recordingCtx();
  fillCapsule(ctx, 10.5, 10.5, 10.5, 10.5, 2, solid('#123456'));
  assert.ok(ctx.rects.length >= 9 && ctx.rects.length <= 16, `${ctx.rects.length} pixels`);
  for (const r of ctx.rects) {
    assert.deepEqual([r.w, r.h, r.color], [1, 1, '#123456']);
    assert.ok(Number.isInteger(r.x) && Number.isInteger(r.y));
  }
});

test('transform rotates counter-clockwise with y up', () => {
  assert.deepEqual(transform(100, 100, 0, [10, 0]), [110, 100]);
  const [x, y] = transform(100, 100, Math.PI / 2, [10, 0]);
  assert.ok(Math.abs(x - 100) < 1e-9 && Math.abs(y - 90) < 1e-9, `${x},${y}`);
});

test('shaded picks the dark colour past the split', () => {
  const colorAt = shaded('light', 'dark', 0.35);
  assert.equal(colorAt(0), 'light');
  assert.equal(colorAt(0.5), 'dark');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/engine/skeleton.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `game/engine/skeleton.js`.

- [ ] **Step 4: Create `game/engine/skeleton.js`**

Cut `fillCapsule`, `solid`, `shaded` and `transform` from `game/events/skiJump/skier.js` (do not copy — they must exist only in the new file). Their bodies stay exactly the same; only `export` is added:

```js
// Capsule skeleton rasteriser shared by the skiers: limbs are thick capsules and discs, rasterised
// per frame as whole pixels so rotation stays crisp. Local coordinates: x right, y up.

export function fillCapsule(ctx, ax, ay, bx, by, radius, colorAt) {
  const minX = Math.floor(Math.min(ax, bx) - radius);
  const maxX = Math.ceil(Math.max(ax, bx) + radius);
  const minY = Math.floor(Math.min(ay, by) - radius);
  const maxY = Math.ceil(Math.max(ay, by) + radius);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = Math.max(dx * dx + dy * dy, 1e-9);
  const length = Math.sqrt(lengthSq);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
      const cx = ax + dx * t;
      const cy = ay + dy * t;
      const distance = Math.hypot(px - cx, py - cy);
      if (distance > radius) continue;
      // Signed offset across the limb, -1 (left of a→b, i.e. "up" for a limb pointing right) .. 1.
      const across = ((px - cx) * (-dy / length) + (py - cy) * (dx / length)) / radius;
      ctx.fillStyle = colorAt(across, t);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export function solid(color) {
  return () => color;
}

// Two-tone shading: the side facing up-left is lit.
export function shaded(light, dark, split = 0.35) {
  return (across) => (across > split ? dark : light);
}

export function transform(x, y, angle, [lx, ly]) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x + lx * cos - ly * sin, y - (lx * sin + ly * cos)];
}
```

Compare with the removed lines in `git diff` after Step 5: only the `export` keywords and the file header comment may differ.

- [ ] **Step 5: Make `skier.js` import the rasteriser**

In `game/events/skiJump/skier.js`:
- Delete the four functions (and the `// ---- rasteriser ---` comment line if nothing else remains under it).
- Add after the palette import:

```js
import { fillCapsule, shaded, solid, transform } from '../../engine/skeleton.js';
```

Everything else in `skier.js` stays as it is.

- [ ] **Step 6: Run the tests and compare the fingerprint**

Run: `node --test tests/engine/skeleton.test.js tests/events/skiJump/`
Expected: PASS.

Re-run the Step 1 command. Expected: exactly the same line as BEFORE. Write it into your report as AFTER. If it differs, stop and report BLOCKED with both lines.

- [ ] **Step 7: Run the full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/engine/skeleton.js game/events/skiJump/skier.js tests/engine/skeleton.test.js
git commit -m "refactor: share the skier capsule rasteriser in skeleton.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Front-view slalom skier

**Files:**
- Create: `game/events/slalom/slalomSkier.js`, `tests/events/slalom/slalomSkier.test.js`

**Interfaces:**
- Consumes: `fillCapsule`, `solid`, `shaded`, `transform` (Task 1); `SKIER_STYLES.classic` from `game/events/skiJump/skier.js` (keys used: `head.color`, `helmet.color`, `helmet.pompom`, `helmet.goggles`, `helmet.lens`, `torso`, `torsoShade`, `arms`, `gloves`, `legs`, `legsShade`, `boots`, `ski`, `skiShade`, `bib.color`, `bib.number`); `recordingCtx` from `tests/helpers/recordingCtx.js`.
- Produces: `drawSlalomSkier(ctx, style, x, y, lean, fallen = false)` — boots' midpoint at canvas (x, y); `lean` is the ski angle in radians (`state.angle`, positive = moving right), clamped to ±60°; about 50 px tall standing.

- [ ] **Step 1: Write the failing test**

`tests/events/slalom/slalomSkier.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE } from '../../../game/engine/palette.js';
import { SKIER_STYLES } from '../../../game/events/skiJump/skier.js';
import { drawSlalomSkier } from '../../../game/events/slalom/slalomSkier.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

const draw = (lean, fallen = false) => {
  const ctx = recordingCtx();
  drawSlalomSkier(ctx, SKIER_STYLES.classic, 300, 200, lean, fallen);
  return ctx.rects;
};

const averageX = (rects) => rects.reduce((sum, r) => sum + r.x, 0) / rects.length;

test('every pose draws whole pixels in the style C colours', () => {
  for (const rects of [draw(-1), draw(0), draw(1), draw(0, true)]) {
    assert.ok(rects.length > 300, `${rects.length} pixels`);
    for (const r of rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), JSON.stringify(r));
    const colors = new Set(rects.map((r) => r.color));
    for (const color of [PALETTE.red, PALETTE.skierSuit, PALETTE.skierBib, PALETTE.skierSki]) {
      assert.ok(colors.has(color), color);
    }
  }
});

test('the ski tips point the way the skier is turning', () => {
  const tipX = (rects) => {
    const skis = rects.filter((r) => r.color === PALETTE.skierSki || r.color === PALETTE.skierSkiShade);
    const lowest = Math.max(...skis.map((r) => r.y));
    return averageX(skis.filter((r) => r.y >= lowest - 2));
  };
  assert.ok(Math.abs(tipX(draw(0)) - 300) <= 8, `straight ${tipX(draw(0))}`);
  assert.ok(tipX(draw(0.8)) > 310, `right ${tipX(draw(0.8))}`);
  assert.ok(tipX(draw(-0.8)) < 290, `left ${tipX(draw(-0.8))}`);
});

test('the body leans into the turn', () => {
  const gogglesX = (rects) => averageX(rects.filter((r) => r.color === PALETTE.skierGoggleFrame));
  assert.ok(Math.abs(gogglesX(draw(0)) - 300) <= 2);
  assert.ok(gogglesX(draw(0.8)) > 305);
  assert.ok(gogglesX(draw(-0.8)) < 295);
});

test('a fallen skier lies flat in the snow', () => {
  const rects = draw(0, true);
  const xs = rects.map((r) => r.x);
  const ys = rects.map((r) => r.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/events/slalom/slalomSkier.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `slalomSkier.js`.

- [ ] **Step 3: Write `game/events/slalom/slalomSkier.js`**

```js
// Front-view slalom skier (facing the viewer, skiing down the screen), built from the same capsule
// skeleton as the ski jumper. Local pose coordinates are canvas pixels: x right, y up, the boots'
// midpoint at (0, 0). Skis are drawn in screen space; tips point down the screen (towards the viewer).

import { PALETTE } from '../../engine/palette.js';
import { fillCapsule, shaded, solid, transform } from '../../engine/skeleton.js';

const MAX_LEAN = Math.PI / 3;
const BODY_TILT = 0.45; // share of the ski angle the body leans into the turn
const BOOT_SPREAD = 6;
const SKI_TAIL = 10;
const SKI_TIP = 22;
const POLE_BASKETS = [[-15, -2], [15, -2]];

// Standing pose, lowered by `crouch` (0 upright .. 1 deepest knee bend in the hardest turn).
function poseFor(crouch) {
  return {
    ankleL: [-BOOT_SPREAD, 0], ankleR: [BOOT_SPREAD, 0],
    kneeL: [-6, 12 - 2 * crouch], kneeR: [6, 12 - 2 * crouch],
    hipL: [-4, 22 - 4 * crouch], hipR: [4, 22 - 4 * crouch],
    pelvis: [0, 22 - 4 * crouch], neck: [0, 36 - 5 * crouch],
    shoulderL: [-7, 35 - 5 * crouch], shoulderR: [7, 35 - 5 * crouch],
    handL: [-13, 22 - 3 * crouch], handR: [13, 22 - 3 * crouch],
    head: [0, 45 - 5 * crouch],
  };
}

function drawSki(ctx, bx, by, angle, style) {
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  fillCapsule(ctx, bx - dx * SKI_TAIL, by - dy * SKI_TAIL, bx + dx * SKI_TIP, by + dy * SKI_TIP, 1.6, shaded(style.ski, style.skiShade, 0.2));
}

// Face, the helmet over the top of the head, the pompom and the goggles across the eyes.
function drawFrontHead(ctx, [hx, hy], angle, style) {
  const { helmet } = style;
  const at = (point) => transform(hx, hy, angle, point);
  fillCapsule(ctx, hx, hy, hx, hy, 5.2, solid(style.head.color));
  const [left, right] = [at([-2.6, 2.2]), at([2.6, 2.2])];
  fillCapsule(ctx, left[0], left[1], right[0], right[1], 3.8, solid(helmet.color));
  const top = at([0, 6.8]);
  fillCapsule(ctx, top[0], top[1], top[0], top[1], 2, solid(helmet.pompom));
  const [gogglesL, gogglesR] = [at([-3.4, 0]), at([3.4, 0])];
  fillCapsule(ctx, gogglesL[0], gogglesL[1], gogglesR[0], gogglesR[1], 1.5, solid(helmet.goggles));
  for (const side of [-1.8, 1.8]) {
    const lens = at([side, 0]);
    fillCapsule(ctx, lens[0], lens[1], lens[0], lens[1], 0.9, solid(helmet.lens));
  }
}

function drawBody(ctx, style, x, y, angle, crouch) {
  const pose = poseFor(crouch);
  const at = (point) => transform(x, y, angle, point);
  const p = Object.fromEntries(Object.entries(pose).map(([key, point]) => [key, at(point)]));

  // Poles behind the arms: from the gloves down to the baskets beside the boots.
  [[p.handL, at(POLE_BASKETS[0])], [p.handR, at(POLE_BASKETS[1])]].forEach(([hand, basket]) => {
    fillCapsule(ctx, hand[0], hand[1], basket[0], basket[1], 0.8, solid(PALETTE.concrete3));
    fillCapsule(ctx, basket[0], basket[1], basket[0], basket[1], 1.5, solid(PALETTE.concrete2));
  });

  [[p.hipL, p.kneeL, p.ankleL], [p.hipR, p.kneeR, p.ankleR]].forEach(([hip, knee, ankle]) => {
    fillCapsule(ctx, hip[0], hip[1], knee[0], knee[1], 3.6, shaded(style.legs, style.legsShade));
    fillCapsule(ctx, knee[0], knee[1], ankle[0], ankle[1], 3.2, shaded(style.legs, style.legsShade));
    fillCapsule(ctx, ankle[0], ankle[1], ankle[0], ankle[1], 2.6, solid(style.boots));
  });

  fillCapsule(ctx, p.pelvis[0], p.pelvis[1], p.neck[0], p.neck[1], 6.5, shaded(style.torso, style.torsoShade, 0.5));
  const bib = at([0, (pose.pelvis[1] + pose.neck[1]) / 2 + 1]);
  fillCapsule(ctx, bib[0], bib[1], bib[0], bib[1], 3.4, solid(style.bib.color));
  fillCapsule(ctx, bib[0], bib[1], bib[0], bib[1], 1, solid(style.bib.number));

  [[p.shoulderL, p.handL], [p.shoulderR, p.handR]].forEach(([shoulder, hand]) => {
    fillCapsule(ctx, shoulder[0], shoulder[1], hand[0], hand[1], 2.4, shaded(style.arms, style.torsoShade));
    fillCapsule(ctx, hand[0], hand[1], hand[0], hand[1], 2.4, solid(style.gloves));
  });

  drawFrontHead(ctx, p.head, angle, style);
}

// Lying on the snow with the skis crossed.
function drawFallen(ctx, style, x, y) {
  drawSki(ctx, x - 4, y, 0.9, style);
  drawSki(ctx, x + 4, y, -0.9, style);
  drawBody(ctx, style, x + 10, y - 2, 1.45, 0);
}

// Draws the skier with the boots' midpoint at canvas (x, y). `lean` is the ski angle in radians
// (positive = moving right); the body tilts into the turn and the knees bend with it.
export function drawSlalomSkier(ctx, style, x, y, lean, fallen = false) {
  if (fallen) {
    drawFallen(ctx, style, x, y);
    return;
  }
  const clamped = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, lean));
  const crouch = Math.abs(clamped) / MAX_LEAN;
  drawSki(ctx, x - BOOT_SPREAD, y, clamped, style);
  drawSki(ctx, x + BOOT_SPREAD, y, clamped, style);
  drawBody(ctx, style, x, y, -clamped * BODY_TILT, crouch);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/events/slalom/slalomSkier.test.js`
Expected: PASS. If a geometry assertion fails, report DONE_WITH_CONCERNS with the measured value instead of changing the test.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/slalom/slalomSkier.js tests/events/slalom/slalomSkier.test.js
git commit -m "feat: add a front-view skeleton slalom skier

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Slalom scene at full resolution

**Files:**
- Rewrite: `game/events/slalom/slalomRender.js`, `tests/events/slalom/slalomRender.test.js`
- Modify: `game/events/slalom/slalomScene.js`, `tests/events/slalom/slalomScene.test.js`

**Interfaces:**
- Consumes: `drawSlalomSkier` (Task 2), `SKIER_STYLES` (`skier.js`), `drawPine(ctx, x, baseY, height)` and `drawSnowfall(ctx, time)` from `game/engine/scenery.js`, `drawBlinking` (`draw.js`), `drawText` (`font.js`), `formatTime` (`core/format.js`), `SLALOM_CONFIG` (`slalomSim.js`), `recordingCtx`, `CANVAS_WIDTH`, `CANVAS_HEIGHT`.
- Produces: `renderSlalom(ctx, { state, track, label, time })` (same signature as today) drawing in canvas pixels; exports `WORLD_SCALE = 2`, `SKIER_SCREEN_Y = 70` (world pixels), `KMH_PER_PX = 0.35`. `SKIER_SPRITES` and `skierPose` are removed. `SlalomScene#highResolution === true`.

- [ ] **Step 1: Write the failing tests**

Replace `tests/events/slalom/slalomRender.test.js` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE } from '../../../game/engine/palette.js';
import { COURSE } from '../../../game/events/slalom/course.js';
import { renderSlalom, SKIER_SCREEN_Y, WORLD_SCALE } from '../../../game/events/slalom/slalomRender.js';
import { createSlalomState } from '../../../game/events/slalom/slalomSim.js';
import { recordingCtx } from '../../helpers/recordingCtx.js';

const RETRO_COLORS = [PALETTE.yellow, PALETTE.ice, PALETTE.blue, PALETTE.navy, PALETTE.pine, PALETTE.brown];

function states() {
  const base = createSlalomState(COURSE);
  base.poles[0] = { hit: true, result: 'passed' };
  base.poles[1] = { hit: false, result: 'missed' };
  return [
    base,
    { ...base, phase: 'running', y: 520, x: 200, angle: 0.3, speed: 150, time: 3.5 },
    { ...base, phase: 'finished', y: COURSE.finishY + 2, speed: 200, time: 30.12 },
    { ...base, phase: 'disqualified', reason: 'outOfBounds', y: 900, x: 59 },
  ];
}

function render(state, time = 0.2) {
  const ctx = recordingCtx();
  renderSlalom(ctx, { state, track: [{ x: 160, y: 10 }, { x: 161, y: 12 }], label: 'YRITYS 1/3', time });
  return ctx.rects;
}

test('renders every phase in whole canvas pixels without the old retro colours', () => {
  for (const state of states()) {
    const rects = render(state);
    assert.ok(rects.length > 2000, `${state.phase}: ${rects.length} rects`);
    for (const r of rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${state.phase} ${JSON.stringify(r)}`);
    const used = new Set(rects.map((r) => r.color));
    for (const color of RETRO_COLORS) assert.ok(!used.has(color), `${state.phase} still uses ${color}`);
  }
});

test('the skier is drawn in the upper part of the view at canvas scale', () => {
  const running = states()[1];
  const suit = render(running).filter((r) => r.color === PALETTE.skierSuit);
  assert.ok(suit.length > 0);
  const skierY = SKIER_SCREEN_Y * WORLD_SCALE;
  for (const r of suit) assert.ok(r.y > skierY - 60 && r.y < skierY, `suit pixel at ${r.y}`);
  const skierX = running.x * WORLD_SCALE;
  const meanX = suit.reduce((sum, r) => sum + r.x, 0) / suit.length;
  assert.ok(Math.abs(meanX - skierX) < 12, `suit x ${meanX} vs ${skierX}`);
});

test('standing gates cast a slanted shadow on the snow', () => {
  // Poles 0 (red, y 300) and 1 (blue, y 530) are both in view, untouched.
  const state = { ...createSlalomState(COURSE), phase: 'running', y: 340, x: 160, speed: 120, time: 2 };
  const rects = render(state);
  assert.ok(rects.some((r) => r.color === PALETTE.shadow && r.w === 1 && r.h === 2), 'pole shadow');
  assert.ok(rects.some((r) => r.color === PALETTE.red && r.w === 4 && r.h === 28), 'red pole');
  assert.ok(rects.some((r) => r.color === PALETTE.guide && r.w === 4 && r.h === 28), 'blue pole');
});

test('the start hut and the finish banner appear at their ends of the course', () => {
  const [ready, , finished] = states();
  assert.ok(render(ready).some((r) => r.color === PALETTE.wood3 && r.w === 84), 'start hut wall');
  assert.ok(render(finished).some((r) => r.color === PALETTE.red && r.w === 400 && r.h === 20), 'finish banner');
});
```

Append to `tests/events/slalom/slalomScene.test.js`:

```js
test('the slalom scene draws at the full canvas resolution', () => {
  const scene = new SlalomScene({ game: recordingGame(), mode: 'practice', attemptNumber: 1, onComplete() {} });
  assert.equal(scene.highResolution, true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/events/slalom/slalomRender.test.js tests/events/slalom/slalomScene.test.js`
Expected: FAIL — `WORLD_SCALE` is not exported, the old render uses retro colours, `highResolution` is `undefined`.

- [ ] **Step 3: Rewrite `game/events/slalom/slalomRender.js`**

Replace the whole file with:

```js
import { formatTime } from '../../core/format.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../engine/constants.js';
import { drawBlinking } from '../../engine/draw.js';
import { drawText } from '../../engine/font.js';
import { PALETTE } from '../../engine/palette.js';
import { drawPine, drawSnowfall } from '../../engine/scenery.js';
import { SKIER_STYLES } from '../skiJump/skier.js';
import { SLALOM_CONFIG } from './slalomSim.js';
import { drawSlalomSkier } from './slalomSkier.js';

// Draws at the full 640×512 canvas (SlalomScene.highResolution). The simulation works in world
// pixels (320 wide); WORLD_SCALE maps them to the canvas, so the view covers the same area as before.
export const WORLD_SCALE = 2;
export const SKIER_SCREEN_Y = 70; // world pixels from the top of the view to the skier's boots
export const KMH_PER_PX = 0.35;

const HUD_HEIGHT = 44;
const TEXT_SCALE = 2;
const GROOMER_SPACING = 32;
const SIDE_ROW = 48; // canvas px between pines, spectators and fence posts along the course
const POLE_HEIGHT = 28;
const SPECTATOR_COLORS = [PALETTE.suitPink, PALETTE.guide, PALETTE.wood2, PALETTE.pineLight, PALETTE.concrete1];

const toCanvasX = (x) => Math.round(x * WORLD_SCALE);
const toCanvasY = (y, top) => Math.round((y - top) * WORLD_SCALE);
const wrap = (value, period) => ((value % period) + period) % period;

// ---- slope, track and sides -------------------------------------------------------------------

function drawSlope(ctx, course, offset) {
  const left = toCanvasX(course.fenceLeftX);
  const right = toCanvasX(course.fenceRightX);
  ctx.fillStyle = PALETTE.snowMid;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = PALETTE.snowLight;
  ctx.fillRect(left, 0, right - left, CANVAS_HEIGHT);
  // Groomer lines scrolling with the course.
  ctx.fillStyle = PALETTE.snowMid;
  for (let y = wrap(-offset, GROOMER_SPACING); y < CANVAS_HEIGHT; y += GROOMER_SPACING) {
    ctx.fillRect(left, y, right - left, 1);
  }
}

function drawTrack(ctx, track, top) {
  ctx.fillStyle = PALETTE.trackGroove;
  for (const point of track) {
    const y = toCanvasY(point.y, top);
    if (y < 0 || y >= CANVAS_HEIGHT) continue;
    const x = toCanvasX(point.x);
    ctx.fillRect(x - 7, y, 2, 4);
    ctx.fillRect(x + 5, y, 2, 4);
  }
}

function drawPineWithShadow(ctx, x, baseY, height) {
  ctx.fillStyle = PALETTE.shadow;
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 2 + i * 2, baseY - 1 + i, Math.round(height / 4), 1);
  drawPine(ctx, x, baseY, height);
}

// A spectator in a winter coat and a woolly hat; every third one waves (arm up one second, down one).
function drawSpectator(ctx, x, baseY, index, time) {
  ctx.fillStyle = PALETTE.concrete3;
  ctx.fillRect(x + 1, baseY - 6, 3, 6);
  ctx.fillRect(x + 6, baseY - 6, 3, 6);
  ctx.fillStyle = SPECTATOR_COLORS[index % SPECTATOR_COLORS.length];
  ctx.fillRect(x, baseY - 16, 10, 10);
  if (index % 3 === 0 && Math.floor(time + index * 0.37) % 2 === 0) ctx.fillRect(x + 10, baseY - 24, 2, 9);
  ctx.fillStyle = PALETTE.skin;
  ctx.fillRect(x + 2, baseY - 22, 6, 6);
  ctx.fillStyle = index % 2 === 0 ? PALETTE.red : PALETTE.guide;
  ctx.fillRect(x + 2, baseY - 24, 6, 3);
}

function drawNet(ctx, fenceX, offset) {
  ctx.fillStyle = PALETTE.snowDark;
  ctx.fillRect(fenceX - 1, 0, 2, CANVAS_HEIGHT);
  for (let y = wrap(-offset, 4); y < CANVAS_HEIGHT; y += 4) ctx.fillRect(fenceX - 2, y, 4, 1);
}

function drawFencePost(ctx, fenceX, baseY) {
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(fenceX - 2, baseY - 10, 4, 10);
  ctx.fillStyle = PALETTE.wood6;
  ctx.fillRect(fenceX + 1, baseY - 10, 1, 10);
}

function drawSides(ctx, course, offset, time) {
  const left = toCanvasX(course.fenceLeftX);
  const right = toCanvasX(course.fenceRightX);
  drawNet(ctx, left, offset);
  drawNet(ctx, right, offset);
  const first = Math.floor(offset / SIDE_ROW) - 1;
  for (let i = first; i < first + CANVAS_HEIGHT / SIDE_ROW + 3; i++) {
    const y = i * SIDE_ROW - offset;
    const row = Math.abs(i);
    if (row % 2 === 0) {
      drawPineWithShadow(ctx, 28, y, 44 + (row % 3) * 8);
      drawPineWithShadow(ctx, CANVAS_WIDTH - 28, y, 44 + ((row + 1) % 3) * 8);
    } else {
      drawSpectator(ctx, 72, y, row, time);
      drawSpectator(ctx, CANVAS_WIDTH - 76, y, row + 3, time);
    }
    drawFencePost(ctx, left, y);
    drawFencePost(ctx, right, y);
  }
}

// ---- start and finish ---------------------------------------------------------------------------

function drawStartHut(ctx, course, top) {
  const cx = toCanvasX(course.startX);
  const y = toCanvasY(course.startY, top) - 60;
  if (y < -80 || y > CANVAS_HEIGHT) return;
  ctx.fillStyle = PALETTE.wood8;
  ctx.fillRect(cx - 50, y, 100, 12);
  ctx.fillStyle = PALETTE.wood3;
  ctx.fillRect(cx - 42, y + 12, 84, 36);
  ctx.fillStyle = PALETTE.wood5;
  for (let i = 0; i < 84; i += 8) ctx.fillRect(cx - 42 + i, y + 12, 1, 36);
  ctx.fillStyle = PALETTE.wood8;
  ctx.fillRect(cx - 16, y + 22, 32, 26);
}

function drawFinish(ctx, course, top) {
  const y = toCanvasY(course.finishY, top);
  if (y < -80 || y > CANVAS_HEIGHT + 80) return;
  const left = toCanvasX(course.fenceLeftX);
  const right = toCanvasX(course.fenceRightX);
  for (let x = left; x < right; x += 8) {
    const even = ((x - left) / 8) % 2 === 0;
    ctx.fillStyle = even ? PALETTE.black : PALETTE.paper;
    ctx.fillRect(x, y, 8, 4);
    ctx.fillStyle = even ? PALETTE.paper : PALETTE.black;
    ctx.fillRect(x, y + 4, 8, 4);
  }
  for (const postX of [left, right - 8]) {
    ctx.fillStyle = PALETTE.concrete1;
    ctx.fillRect(postX, y - 56, 8, 56);
    ctx.fillStyle = PALETTE.concrete3;
    ctx.fillRect(postX + 6, y - 56, 2, 56);
  }
  ctx.fillStyle = PALETTE.red;
  ctx.fillRect(left, y - 60, right - left, 20);
  ctx.fillStyle = PALETTE.darkRed;
  ctx.fillRect(left, y - 42, right - left, 2);
  drawText(ctx, 'MAALI', (left + right) / 2, y - 56, { align: 'center', scale: TEXT_SCALE, color: PALETTE.paper });
}

// ---- gates and skier ----------------------------------------------------------------------------

function drawPole(ctx, pole, status, top) {
  const x = toCanvasX(pole.x);
  const baseY = toCanvasY(pole.y, top);
  if (baseY < -POLE_HEIGHT || baseY > CANVAS_HEIGHT + POLE_HEIGHT) return;
  const color = pole.color === 'red' ? PALETTE.red : PALETTE.guide;
  if (status.hit) {
    // Knocked over, lying on the snow.
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(x + i, baseY - Math.floor(i / 3) + 2, 1, 2);
      ctx.fillStyle = color;
      ctx.fillRect(x + i, baseY - Math.floor(i / 3), 1, 3);
    }
  } else {
    ctx.fillStyle = PALETTE.shadow;
    for (let i = 0; i < 14; i++) ctx.fillRect(x + 2 + i, baseY + Math.floor(i / 3), 1, 2);
    ctx.fillStyle = color;
    ctx.fillRect(x - 2, baseY - POLE_HEIGHT, 4, POLE_HEIGHT);
    const flagX = pole.side === 'left' ? x - 14 : x + 2;
    ctx.fillRect(flagX, baseY - POLE_HEIGHT, 12, 10);
    // Arrow towards the side the skier must pass on.
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(flagX + 4, baseY - POLE_HEIGHT + 3, 4, 4);
    ctx.fillRect(pole.side === 'left' ? flagX + 2 : flagX + 8, baseY - POLE_HEIGHT + 4, 2, 2);
  }
  if (status.result === 'passed') {
    ctx.fillStyle = PALETTE.green;
    ctx.fillRect(x - 3, baseY + 4, 6, 6);
  } else if (status.result === 'missed') {
    ctx.fillStyle = PALETTE.red;
    for (let i = 0; i < 9; i++) {
      ctx.fillRect(x - 4 + i, baseY + 4 + i, 2, 2);
      ctx.fillRect(x + 4 - i, baseY + 4 + i, 2, 2);
    }
  }
}

function drawSkierWithShadow(ctx, state) {
  const x = toCanvasX(state.x);
  const y = SKIER_SCREEN_Y * WORLD_SCALE;
  ctx.fillStyle = PALETTE.shadow;
  for (let row = -3; row <= 3; row++) {
    const half = Math.round(16 * Math.sqrt(1 - (row / 4) ** 2));
    ctx.fillRect(x - half + 4, y + 2 + row, half * 2, 1);
  }
  drawSlalomSkier(ctx, SKIER_STYLES.classic, x, y, state.angle, state.phase === 'disqualified');
}

// ---- HUD and banners ----------------------------------------------------------------------------

function drawHud(ctx, state, label) {
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
  drawText(ctx, `AIKA ${formatTime(state.time)}`, 8, 6, { scale: TEXT_SCALE, color: PALETTE.white });
  drawText(ctx, `${Math.round(state.speed * KMH_PER_PX)} KM/H`, 8, 24, { scale: TEXT_SCALE, color: PALETTE.white });
  ctx.fillStyle = PALETTE.darkGrey;
  ctx.fillRect(104, 26, 100, 10);
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(104, 26, Math.round((100 * state.speed) / SLALOM_CONFIG.maxSpeed), 10);
  drawText(ctx, label, CANVAS_WIDTH / 2, 6, { align: 'center', scale: TEXT_SCALE, color: PALETTE.skyLight });
  drawText(ctx, `OSUMAT ${state.hits}`, CANVAS_WIDTH - 8, 6, { align: 'right', scale: TEXT_SCALE, color: PALETTE.white });
  drawText(ctx, `OHITETUT ${state.missed}/${SLALOM_CONFIG.maxMissed}`, CANVAS_WIDTH - 8, 24, {
    align: 'right',
    scale: TEXT_SCALE,
    color: state.missed > 0 ? PALETTE.orange : PALETTE.white,
  });
}

function drawBanner(ctx, state, time) {
  if (state.phase === 'ready') {
    drawBlinking(ctx, 'VÄLILYÖNTI = LÄHTÖ', CANVAS_WIDTH / 2, 260, time, { scale: TEXT_SCALE, color: PALETTE.night });
  } else if (state.phase === 'finished') {
    drawText(ctx, 'MAALI!', CANVAS_WIDTH / 2, 240, { align: 'center', scale: 4, color: PALETTE.paper, shadow: PALETTE.slate });
  } else if (state.phase === 'disqualified') {
    drawText(ctx, 'HYLÄTTY', CANVAS_WIDTH / 2, 240, { align: 'center', scale: 4, color: PALETTE.red, shadow: PALETTE.black });
  }
}

export function renderSlalom(ctx, { state, track, label, time }) {
  const { course } = state;
  const top = state.y - SKIER_SCREEN_Y;
  const offset = Math.round(top * WORLD_SCALE);
  drawSlope(ctx, course, offset);
  drawTrack(ctx, track, top);
  drawSides(ctx, course, offset, time);
  drawStartHut(ctx, course, top);
  drawFinish(ctx, course, top);
  course.poles.forEach((pole, index) => drawPole(ctx, pole, state.poles[index], top));
  drawSkierWithShadow(ctx, state);
  drawSnowfall(ctx, time);
  drawHud(ctx, state, label);
  drawBanner(ctx, state, time);
}
```

- [ ] **Step 4: Make the scene high resolution**

In `game/events/slalom/slalomScene.js`, in the constructor add as the first line after `this.game = game;`:

```js
    this.highResolution = true;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/events/slalom/`
Expected: PASS (render, skier, scene, sim, course and bot tests). If a render assertion fails, report DONE_WITH_CONCERNS with the measured values rather than loosening a test.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test` — expected: all pass. Check that nothing else imports `SKIER_SPRITES` or `skierPose` from `slalomRender.js`: `grep -rn "SKIER_SPRITES\|slalomRender.js" game tests`.

```bash
git add game/events/slalom/slalomRender.js game/events/slalom/slalomScene.js tests/events/slalom/slalomRender.test.js tests/events/slalom/slalomScene.test.js
git commit -m "feat: draw the slalom in the realistic high-resolution style

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Browser check (controller)**

Run `npm run dev`, open `http://127.0.0.1:8080/`, practice → PUJOTTELU. Check a full run: the skier leans smoothly in turns, gates pass/hit/miss markers, the track grooves, spectators and fences scroll, the finish banner, a disqualification (ride into a fence), and the pause menu over the slalom. Frame rate stays at 60 fps.
