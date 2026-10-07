# Menu Graphics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the six menu scenes to the ski jump's realistic muted style and to the full 640×512 canvas: a drifting venue backdrop (misty sky, forests, distant ski jump, snowy plain), slate panels and paper/red text.

**Architecture:** The ski jump's landscape helpers move unchanged from `skiJumpRender.js` into a shared `game/engine/scenery.js`, which also gets `drawVenueBackdrop(ctx, time)`. `drawPanel` and `Menu#render` get the new look; the six menu scenes set `highResolution = true` and draw in canvas pixels (coordinates and text scale doubled). Slalom and the placeholder event keep drawing at 320×256.

**Tech Stack:** Plain JS ES modules, Canvas 2D (`fillRect` only), `node:test`.

**Design:** `plans/2026-10-07-menu-graphics-design.md`.

## Global Constraints

- No npm dependencies; Node built-ins only. Never run `npm install`.
- All code, identifiers, comments and commit messages in English. All player-visible text in Finnish, UPPERCASE; player-visible texts do not change in this plan.
- Never store API keys or tokens in code or files.
- Canvas 640×512 (`CANVAS_WIDTH`, `CANVAS_HEIGHT`); low-resolution scenes draw in 320×256 logical pixels (`SCREEN_WIDTH`, `SCREEN_HEIGHT`) scaled ×2; a scene with `highResolution = true` draws 1:1. All graphics drawn in code with `ctx.fillRect` (no image files, no paths/arcs).
- Fixed update step 1/60 s; timing uses only `dt` (never `performance.now()`).
- The ski jump must look exactly as before (same rects, same order, same colours).
- Menu behaviour, sounds and flow do not change; only rendering.
- Tests: `npm test` (= `node --test tests/`), files `tests/**/*.test.js`.
- Browser checks use `npm run dev` (no results are committed or pushed).
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

```
game/engine/scenery.js                    CREATE: shared landscape layers + drawVenueBackdrop
game/events/skiJump/skiJumpRender.js      MODIFY: import the landscape helpers from scenery.js
game/engine/palette.js                    MODIFY: slate, slateEdge, paper, paperDim
game/engine/draw.js                       MODIFY: new drawPanel look (drawWinterBackdrop/Snowfall stay for the placeholder)
game/ui/menu.js                           MODIFY: scale option, red/paper colours
game/scenes/titleScene.js                 MODIFY: high resolution, venue backdrop
game/scenes/practiceSelectScene.js        MODIFY: high resolution, venue backdrop
game/scenes/infoScene.js                  MODIFY: high resolution, venue backdrop
game/scenes/pauseScene.js                 MODIFY: high resolution
game/scenes/nicknameScene.js              MODIFY: high resolution, venue backdrop
game/scenes/finalScene.js                 MODIFY: high resolution, venue backdrop
tests/helpers/recordingCtx.js             CREATE: shared recording canvas context for render tests
tests/engine/scenery.test.js              CREATE
tests/engine/draw.test.js                 CREATE
tests/ui/menu.test.js                     MODIFY: render colours and scale
tests/scenes/menuScenes.test.js           CREATE: all six scenes render in the new style
```

---

### Task 1: Shared scenery module

**Files:**
- Create: `game/engine/scenery.js`, `tests/helpers/recordingCtx.js`, `tests/engine/scenery.test.js`
- Modify: `game/events/skiJump/skiJumpRender.js`

**Interfaces:**
- Produces (`game/engine/scenery.js`), all in canvas pixels:
  - `drawMistySky(ctx, camera)` — the ski jump's `drawSky`, renamed; `camera = { x, y }`
  - `drawPine(ctx, x, baseY, height)`
  - `drawForestLayer(ctx, camera, { parallax, spacing, minHeight, maxHeight, baseY, seed })`
  - `FAR_FOREST`, `NEAR_FOREST` — the two forest layer configs the ski jump uses
  - `drawSnowfall(ctx, time)`
- Produces (`tests/helpers/recordingCtx.js`): `recordingCtx()` → `{ rects: [{ x, y, w, h, color }], fillStyle, fillRect }`; throws on a non-finite rect value.

The helpers move unchanged; only `SCREEN_WIDTH`/`SCREEN_HEIGHT` (which in `skiJumpRender.js` are aliases of the canvas size) become `CANVAS_WIDTH`/`CANVAS_HEIGHT`.

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
for (const st of [s, { ...s, phase: 'flight', x: 60, y: -20, speed: 26, angle: 0.8, lipTime: 4, time: 5 }]) {
  renderSkiJump(ctx, { state: st, label: 'X', time: 1.3 });
}
console.log(rects.length, createHash('sha256').update(JSON.stringify(rects)).digest('hex'));
"
```

Write the printed line into your report as the BEFORE fingerprint.

- [ ] **Step 2: Write the shared recording context and the failing test**

`tests/helpers/recordingCtx.js`:

```js
// A canvas context stand-in that records every fillRect with its colour.
export function recordingCtx() {
  const rects = [];
  return {
    rects,
    fillStyle: null,
    fillRect(x, y, w, h) {
      for (const value of [x, y, w, h]) {
        if (!Number.isFinite(value)) throw new Error(`non-finite rect value ${value}`);
      }
      rects.push({ x, y, w, h, color: this.fillStyle });
    },
  };
}
```

`tests/engine/scenery.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../game/engine/constants.js';
import { PALETTE } from '../../game/engine/palette.js';
import {
  drawForestLayer, drawMistySky, drawSnowfall, FAR_FOREST, NEAR_FOREST,
} from '../../game/engine/scenery.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

test('the misty sky starts with full-width bands from the top', () => {
  const ctx = recordingCtx();
  drawMistySky(ctx, { x: 0, y: 1200 });
  assert.deepEqual(ctx.rects[0], { x: 0, y: 0, w: CANVAS_WIDTH, h: 103, color: PALETTE.mist0 });
  assert.ok(ctx.rects.some((r) => r.color === PALETTE.snowDark));
});

test('forest layers are deterministic and scroll with the camera', () => {
  const draw = (x) => {
    const ctx = recordingCtx();
    drawForestLayer(ctx, { x, y: 1200 }, NEAR_FOREST);
    return ctx.rects;
  };
  assert.deepEqual(draw(0), draw(0));
  assert.notDeepEqual(draw(0), draw(40));
  assert.ok(draw(0).some((r) => r.color === PALETTE.pineDark));
  assert.ok(FAR_FOREST.parallax < NEAR_FOREST.parallax);
});

test('snowfall draws 140 flakes inside the canvas', () => {
  const ctx = recordingCtx();
  drawSnowfall(ctx, 3.7);
  assert.equal(ctx.rects.length, 140);
  for (const r of ctx.rects) {
    assert.ok(r.x >= 0 && r.x < CANVAS_WIDTH && r.y >= 0 && r.y < CANVAS_HEIGHT, `${r.x},${r.y}`);
  }
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/engine/scenery.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `game/engine/scenery.js`.

- [ ] **Step 4: Create `game/engine/scenery.js`**

Move these from `game/events/skiJump/skiJumpRender.js` (cut, do not copy): the `SKY_BANDS` constant, `drawSky` (renamed `drawMistySky`), `drawPine`, `drawForestLayer`, `drawSnowfall`. The bodies stay exactly the same except `SCREEN_WIDTH` → `CANVAS_WIDTH` and `SCREEN_HEIGHT` → `CANVAS_HEIGHT`. The result:

```js
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants.js';
import { PALETTE } from './palette.js';
import { createRng } from './rng.js';

// Landscape layers in the realistic style, drawn at the full 640×512 canvas resolution.
// `camera` is { x, y } in canvas pixels; each layer scrolls with it at its own parallax.

const SKY_BANDS = [PALETTE.mist0, PALETTE.mist1, PALETTE.mist2, PALETTE.mist3, PALETTE.mist4];

export const FAR_FOREST = { parallax: 0.25, spacing: 36, minHeight: 14, maxHeight: 22, baseY: 300, seed: 11 };
export const NEAR_FOREST = { parallax: 0.55, spacing: 68, minHeight: 32, maxHeight: 52, baseY: 350, seed: 23 };

export function drawMistySky(ctx, camera) {
  const bandHeight = CANVAS_HEIGHT / SKY_BANDS.length;
  SKY_BANDS.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, Math.floor(index * bandHeight), CANVAS_WIDTH, Math.ceil(bandHeight));
  });
  // A soft, distant snowy ridge drifting slowly behind everything.
  for (let sx = 0; sx < CANVAS_WIDTH; sx++) {
    const m = sx + camera.x * 0.08;
    const top = Math.round(340 + 44 * Math.sin(m * 0.0055) + 20 * Math.sin(m * 0.0155 + 2) - (camera.y - 1000) * 0.04);
    ctx.fillStyle = PALETTE.snowDark;
    ctx.fillRect(sx, top, 1, CANVAS_HEIGHT - top);
    ctx.fillStyle = PALETTE.snowMid;
    ctx.fillRect(sx, top + 12, 1, CANVAS_HEIGHT - top - 12);
  }
}

export function drawPine(ctx, x, baseY, height) {
  const trunk = Math.max(1, Math.round(height / 6));
  ctx.fillStyle = PALETTE.trunk;
  ctx.fillRect(x - Math.floor(trunk / 2), baseY - trunk * 2, trunk, trunk * 2);
  const crown = height - trunk;
  const tierRows = Math.max(3, Math.round(crown / 4));
  for (let row = 0; row < crown; row++) {
    const tier = (row % tierRows) / tierRows;
    const half = Math.round(((row + 1) / crown) * (height / 3) * (0.6 + 0.4 * tier));
    const y = baseY - trunk * 2 - crown + row;
    ctx.fillStyle = PALETTE.pineDark;
    ctx.fillRect(x - half, y, half * 2 + 1, 1);
    ctx.fillStyle = row % 3 === 0 ? PALETTE.pineLight : PALETTE.pineMid;
    ctx.fillRect(x - half + 1, y, Math.max(1, half), 1);
  }
}

export function drawForestLayer(ctx, camera, { parallax, spacing, minHeight, maxHeight, baseY, seed }) {
  const offset = camera.x * parallax;
  const verticalShift = Math.round((camera.y - 1200) * parallax * 0.25);
  const first = Math.floor(offset / spacing) - 1;
  for (let i = first; i < first + CANVAS_WIDTH / spacing + 3; i++) {
    const rng = createRng(seed + i * 7919);
    const sx = Math.round(i * spacing - offset + rng() * spacing * 0.8);
    const height = Math.round(minHeight + rng() * (maxHeight - minHeight));
    const y = Math.round(baseY + rng() * 60 - verticalShift);
    if (rng() < 0.35) continue;
    drawPine(ctx, sx, y, height);
  }
}

export function drawSnowfall(ctx, time) {
  ctx.fillStyle = PALETTE.white;
  for (let i = 0; i < 140; i++) {
    const rng = createRng(1000 + i);
    const speed = 24 + rng() * 44;
    const x = (rng() * CANVAS_WIDTH + Math.sin(time * 0.8 + i) * 12 + CANVAS_WIDTH) % CANVAS_WIDTH;
    const y = (rng() * CANVAS_HEIGHT + time * speed) % CANVAS_HEIGHT;
    const size = i % 3 === 0 ? 2 : 1;
    ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
  }
}
```

Before saving, diff each moved body against the original in `skiJumpRender.js` (`git diff` after Step 5 shows the removed lines) — only the renamed constants and `drawSky` → `drawMistySky` may differ.

- [ ] **Step 5: Make `skiJumpRender.js` use the shared helpers**

In `game/events/skiJump/skiJumpRender.js`:
- Delete `SKY_BANDS`, `drawSky`, `drawPine`, `drawForestLayer` and `drawSnowfall` (and the `// ---- background ---` comment line above `drawSky` if nothing else remains under it).
- Add the import:

```js
import {
  drawForestLayer, drawMistySky, drawSnowfall, FAR_FOREST, NEAR_FOREST,
} from '../../engine/scenery.js';
```

- In `renderSkiJump`, replace the first three drawing lines with:

```js
  drawMistySky(ctx, camera);
  drawForestLayer(ctx, camera, FAR_FOREST);
  drawForestLayer(ctx, camera, NEAR_FOREST);
```

and leave `drawSnowfall(ctx, time);` where it is.
- If `createRng` is no longer used in `skiJumpRender.js` (check with `grep -n createRng game/events/skiJump/skiJumpRender.js`), remove its import. Keep every other import that is still used.

- [ ] **Step 6: Run the tests and compare the fingerprint**

Run: `node --test tests/engine/scenery.test.js tests/events/skiJump/`
Expected: PASS.

Re-run the Step 1 command. Expected: exactly the same line as BEFORE (same rect count and hash). Write it into your report as AFTER. If it differs, stop and report BLOCKED.

- [ ] **Step 7: Run the full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/engine/scenery.js game/events/skiJump/skiJumpRender.js tests/helpers/recordingCtx.js tests/engine/scenery.test.js
git commit -m "refactor: share the ski jump landscape layers in scenery.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Venue backdrop, palette, panel and menu look

**Files:**
- Modify: `game/engine/scenery.js`, `game/engine/palette.js`, `game/engine/draw.js`, `game/ui/menu.js`
- Create: `tests/engine/draw.test.js`
- Modify tests: `tests/engine/scenery.test.js`, `tests/ui/menu.test.js`

**Interfaces:**
- Consumes: `drawMistySky`, `drawForestLayer`, `drawSnowfall`, `FAR_FOREST`, `NEAR_FOREST` (Task 1), `recordingCtx` (Task 1).
- Produces:
  - `drawVenueBackdrop(ctx, time)` in `scenery.js` — the whole menu background in canvas pixels, a pure function of `time` (seconds).
  - `PALETTE.slate` `#2a2d36`, `PALETTE.slateEdge` `#6a6d75`, `PALETTE.paper` `#ece9e2`, `PALETTE.paperDim` `#a9a7a2`.
  - `drawPanel(ctx, x, y, width, height)` — 2 px `slateEdge` border around a `slate` fill at 88 % opacity; one fill rect followed by four border rects.
  - `Menu#render(ctx, centerX, y, { lineHeight = 12, maxVisible = Infinity, scale = 1 })` — selected row in `PALETTE.red` with `> … <`, other rows in `PALETTE.paper`, text at `scale`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine/scenery.test.js` (add `drawVenueBackdrop` to the existing import from `scenery.js`):

```js
test('the venue backdrop is deterministic, drifts with time and shows the distant ski jump', () => {
  const draw = (time) => {
    const ctx = recordingCtx();
    drawVenueBackdrop(ctx, time);
    return ctx.rects;
  };
  const start = draw(0);
  assert.deepEqual(start, draw(0));
  assert.notDeepEqual(start, draw(10));
  assert.deepEqual(start[0], { x: 0, y: 0, w: CANVAS_WIDTH, h: 103, color: PALETTE.mist0 });
  for (const r of start) {
    assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), JSON.stringify(r));
  }
  assert.ok(start.some((r) => r.color === PALETTE.wood2), 'distant inrun');
  assert.ok(start.some((r) => r.color === PALETTE.concrete2), 'distant pillars');
  assert.ok(start.some((r) => r.color === PALETTE.snowLight && r.w === CANVAS_WIDTH), 'snowy plain');
});
```

`tests/engine/draw.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawPanel } from '../../game/engine/draw.js';
import { PALETTE } from '../../game/engine/palette.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

test('a panel is a translucent slate fill inside a 2 px border', () => {
  const ctx = recordingCtx();
  drawPanel(ctx, 100, 50, 200, 80);
  assert.deepEqual(ctx.rects, [
    { x: 102, y: 52, w: 196, h: 76, color: 'rgba(42, 45, 54, 0.88)' },
    { x: 100, y: 50, w: 200, h: 2, color: PALETTE.slateEdge },
    { x: 100, y: 128, w: 200, h: 2, color: PALETTE.slateEdge },
    { x: 100, y: 52, w: 2, h: 76, color: PALETTE.slateEdge },
    { x: 298, y: 52, w: 2, h: 76, color: PALETTE.slateEdge },
  ]);
});
```

Append to `tests/ui/menu.test.js` (add `import { PALETTE } from '../../game/engine/palette.js';` and `import { recordingCtx } from '../helpers/recordingCtx.js';` at the top):

```js
test('render shows the selected row in red and the others in paper, at the given scale', () => {
  const menu = new Menu(items());
  menu.update(fakeInput(['ArrowDown']));
  const ctx = recordingCtx();
  menu.render(ctx, 320, 100, { lineHeight: 28, scale: 2 });
  const colors = new Set(ctx.rects.map((r) => r.color));
  assert.deepEqual([...colors].sort(), [PALETTE.paper, PALETTE.red].sort());
  assert.ok(ctx.rects.every((r) => r.w === 2 && r.h === 2));
  const redRows = new Set(ctx.rects.filter((r) => r.color === PALETTE.red).map((r) => Math.floor((r.y - 100) / 28)));
  assert.deepEqual([...redRows], [1]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/engine/scenery.test.js tests/engine/draw.test.js tests/ui/menu.test.js`
Expected: FAIL — `drawVenueBackdrop` is not exported, the panel rects differ (old colours), the menu uses yellow/white.

- [ ] **Step 3: Add the palette keys**

In `game/engine/palette.js`, after `skierSkiShade`, add:

```js
  // Menu panels and text in the realistic style.
  slate: '#2a2d36',
  slateEdge: '#6a6d75',
  paper: '#ece9e2',
  paperDim: '#a9a7a2',
```

- [ ] **Step 4: Add the venue backdrop to `scenery.js`**

Append to `game/engine/scenery.js`:

```js
// ---- menu backdrop: the venue seen from the snowy plain ---------------------------------------

const MENU_DRIFT_PX_PER_S = 11; // the near forest (parallax 0.55) drifts ≈6 px/s
const MENU_CAMERA_Y = 1200;
const JUMP_PARALLAX = 0.08; // the distant ski jump moves with the ridge
const JUMP_PERIOD_PX = 1600; // it scrolls out on the left and comes back from the right
const JUMP_HOME_X = 380; // left edge of the silhouette at time 0
const JUMP_BASE_Y = 330; // height of the takeoff table's foot
const JUMP_WIDTH_PX = 250;
const PLAIN_TOP = 436;

function drawDistantJump(ctx, left, baseY) {
  const inrunTop = (i) => baseY - 66 + Math.round(Math.min(i, 86) * 0.7);
  // Landing hill: a snowy slope falling away from the table.
  for (let i = 0; i < 150; i++) {
    const top = baseY - 6 + Math.round(i * 0.4);
    ctx.fillStyle = PALETTE.snowDark;
    ctx.fillRect(left + 100 + i, top, 1, 1);
    ctx.fillStyle = PALETTE.snowMid;
    ctx.fillRect(left + 100 + i, top + 1, 1, CANVAS_HEIGHT - top - 1);
  }
  // Concrete pillars under the inrun.
  ctx.fillStyle = PALETTE.concrete2;
  for (const i of [16, 40, 64]) ctx.fillRect(left + i, inrunTop(i) + 5, 3, baseY - inrunTop(i) - 5);
  // Wooden inrun: a 35° ramp curving into the flat takeoff table.
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = PALETTE.wood2;
    ctx.fillRect(left + i, inrunTop(i), 1, 2);
    ctx.fillStyle = PALETTE.wood5;
    ctx.fillRect(left + i, inrunTop(i) + 2, 1, 3);
  }
}

function drawSnowPlain(ctx) {
  ctx.fillStyle = PALETTE.snowDark;
  ctx.fillRect(0, PLAIN_TOP, CANVAS_WIDTH, 2);
  ctx.fillStyle = PALETTE.snowLight;
  ctx.fillRect(0, PLAIN_TOP + 2, CANVAS_WIDTH, CANVAS_HEIGHT - PLAIN_TOP - 2);
  ctx.fillStyle = PALETTE.snowMid;
  for (let y = PLAIN_TOP + 16; y < CANVAS_HEIGHT; y += 18) ctx.fillRect(0, y, CANVAS_WIDTH, 1);
}

export function drawVenueBackdrop(ctx, time) {
  const camera = { x: Math.round(time * MENU_DRIFT_PX_PER_S), y: MENU_CAMERA_Y };
  drawMistySky(ctx, camera);
  let jumpLeft = JUMP_HOME_X - Math.round((camera.x * JUMP_PARALLAX) % JUMP_PERIOD_PX);
  if (jumpLeft < -JUMP_WIDTH_PX) jumpLeft += JUMP_PERIOD_PX;
  if (jumpLeft < CANVAS_WIDTH) drawDistantJump(ctx, jumpLeft, JUMP_BASE_Y);
  drawForestLayer(ctx, camera, FAR_FOREST);
  drawForestLayer(ctx, camera, NEAR_FOREST);
  drawSnowPlain(ctx);
  drawSnowfall(ctx, time);
}
```

(`camera.x` is rounded so every layer stays on whole pixels.)

- [ ] **Step 5: Restyle `drawPanel`**

In `game/engine/draw.js`, replace `drawPanel` with:

```js
const PANEL_BORDER = 2;

function translucent(hex, alpha) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const PANEL_FILL = translucent(PALETTE.slate, 0.88);

// A slightly see-through slate panel with a thin concrete-grey border (canvas pixels).
export function drawPanel(ctx, x, y, width, height) {
  const b = PANEL_BORDER;
  ctx.fillStyle = PANEL_FILL;
  ctx.fillRect(x + b, y + b, width - 2 * b, height - 2 * b);
  ctx.fillStyle = PALETTE.slateEdge;
  ctx.fillRect(x, y, width, b);
  ctx.fillRect(x, y + height - b, width, b);
  ctx.fillRect(x, y + b, b, height - 2 * b);
  ctx.fillRect(x + width - b, y + b, b, height - 2 * b);
}
```

Leave `drawWinterBackdrop`, `drawBlinking` and `Snowfall` unchanged (the placeholder event still uses them).

- [ ] **Step 6: Restyle `Menu#render`**

In `game/ui/menu.js`, replace `render` with:

```js
  render(ctx, centerX, y, { lineHeight = 12, maxVisible = Infinity, scale = 1 } = {}) {
    const [start, end] = visibleWindow(this.items.length, this.index, maxVisible);
    for (let i = start; i < end; i++) {
      const isSelected = i === this.index;
      const text = isSelected ? `> ${labelOf(this.items[i])} <` : labelOf(this.items[i]);
      drawText(ctx, text, centerX, y + (i - start) * lineHeight, {
        align: 'center',
        scale,
        color: isSelected ? PALETTE.red : PALETTE.paper,
      });
    }
  }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test tests/engine/scenery.test.js tests/engine/draw.test.js tests/ui/menu.test.js`
Expected: PASS.

- [ ] **Step 8: Run the full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/engine/scenery.js game/engine/palette.js game/engine/draw.js game/ui/menu.js tests/engine/scenery.test.js tests/engine/draw.test.js tests/ui/menu.test.js
git commit -m "feat: add the venue backdrop and the muted panel and menu look

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Title, practice select, info and pause at full resolution

**Files:**
- Modify: `game/scenes/titleScene.js`, `game/scenes/practiceSelectScene.js`, `game/scenes/infoScene.js`, `game/scenes/pauseScene.js`
- Create: `tests/scenes/menuScenes.test.js`

**Interfaces:**
- Consumes: `drawVenueBackdrop(ctx, time)` (Task 2), `drawPanel`, `drawBlinking`, `Menu#render(..., { scale })`, `PALETTE.slate/slateEdge/paper/paperDim/red`, `CANVAS_WIDTH`, `CANVAS_HEIGHT`, `recordingCtx` (Task 1).
- Produces: each of the four scenes has `highResolution = true` and draws in canvas pixels. Constructors, `update` behaviour and callbacks are unchanged.

- [ ] **Step 1: Write the failing test**

`tests/scenes/menuScenes.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../game/engine/constants.js';
import { PALETTE } from '../../game/engine/palette.js';
import { InfoScene } from '../../game/scenes/infoScene.js';
import { PauseScene } from '../../game/scenes/pauseScene.js';
import { PracticeSelectScene } from '../../game/scenes/practiceSelectScene.js';
import { TitleScene } from '../../game/scenes/titleScene.js';
import { fakeInput } from '../helpers/fakeInput.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

const OLD_COLORS = [PALETTE.yellow, PALETTE.skyLight, PALETTE.night];

function fakeGame() {
  return {
    audio: { muted: false, playSfx() {}, playSong() {}, toggleMuted() {} },
    repository: { getNicknames: () => new Promise(() => {}), saveResult: () => new Promise(() => {}) },
  };
}

function assertMenuStyle(scene, name) {
  assert.equal(scene.highResolution, true, `${name} highResolution`);
  const ctx = recordingCtx();
  scene.render(ctx);
  assert.ok(ctx.rects.length > 100, `${name} draws`);
  for (const r of ctx.rects) {
    assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${name} ${JSON.stringify(r)}`);
  }
  const used = new Set(ctx.rects.map((r) => r.color));
  for (const color of OLD_COLORS) assert.ok(!used.has(color), `${name} still uses ${color}`);
  assert.ok(used.has(PALETTE.paper) || used.has(PALETTE.red), `${name} uses the new text colours`);
  return ctx;
}

const fullCanvasBackdrop = (ctx) => ctx.rects[0].x === 0 && ctx.rects[0].y === 0 && ctx.rects[0].w === CANVAS_WIDTH;

test('the title scene uses the venue backdrop and the new look', () => {
  const scene = new TitleScene({ game: fakeGame(), onCompetition() {}, onPractice() {} });
  scene.update(1 / 60, fakeInput([]));
  assert.ok(fullCanvasBackdrop(assertMenuStyle(scene, 'title')));
});

test('the practice select scene uses the venue backdrop and the new look', () => {
  const scene = new PracticeSelectScene({ game: fakeGame(), onSelect() {}, onBack() {} });
  scene.update(1 / 60, fakeInput([]));
  assert.ok(fullCanvasBackdrop(assertMenuStyle(scene, 'practice select')));
});

test('the info scene uses the venue backdrop and the new look', () => {
  const scene = new InfoScene({ game: fakeGame(), title: 'MÄKIHYPPY', lines: ['HARJOITTELU', '', 'ESC = LOPETA'], onContinue() {} });
  scene.update(1 / 60, fakeInput([]));
  assert.ok(fullCanvasBackdrop(assertMenuStyle(scene, 'info')));
});

test('the pause scene dims the whole canvas and draws its panel in canvas pixels', () => {
  const scene = new PauseScene({ game: fakeGame(), onResume() {}, onQuit() {} });
  const ctx = assertMenuStyle(scene, 'pause');
  assert.deepEqual(ctx.rects[0], { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT, color: 'rgba(0, 0, 0, 0.6)' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/scenes/menuScenes.test.js`
Expected: FAIL — `highResolution` is `undefined` for every scene.

- [ ] **Step 3: Title scene**

`game/scenes/titleScene.js` — replace the whole file:

```js
import { TITLE_THEME } from '../audio/songs.js';
import { drawPanel } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { drawVenueBackdrop } from '../engine/scenery.js';
import { Menu } from '../ui/menu.js';

export class TitleScene {
  constructor({ game, onCompetition, onPractice }) {
    this.game = game;
    this.highResolution = true;
    this.time = 0;
    this.menu = new Menu(
      [{ label: 'KILPAILU', value: onCompetition }, { label: 'HARJOITTELU', value: onPractice }],
      { onMove: () => game.audio.playSfx('select') },
    );
  }

  enter() {
    this.game.audio.playSong(TITLE_THEME);
  }

  update(dt, input) {
    this.time += dt;
    const item = this.menu.update(input);
    if (item) {
      this.game.audio.playSfx('confirm');
      item.value();
    }
  }

  render(ctx) {
    drawVenueBackdrop(ctx, this.time);
    drawText(ctx, 'WINTER', 320, 60, { align: 'center', scale: 8, color: PALETTE.paper, shadow: PALETTE.slate });
    drawText(ctx, 'GAMES', 320, 128, { align: 'center', scale: 8, color: PALETTE.paper, shadow: PALETTE.slate });
    drawText(ctx, 'TALVIKISAT', 320, 200, { align: 'center', scale: 2, color: PALETTE.red, shadow: PALETTE.slate });
    drawPanel(ctx, 180, 248, 280, 88);
    this.menu.render(ctx, 320, 268, { lineHeight: 28, scale: 2 });
    drawText(ctx, 'NUOLET + VÄLILYÖNTI', 320, 472, { align: 'center', scale: 2, color: PALETTE.slate });
  }
}
```

- [ ] **Step 4: Practice select scene**

In `game/scenes/practiceSelectScene.js`:
- Imports: replace `import { drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';` with `import { drawPanel } from '../engine/draw.js';` and add `import { drawVenueBackdrop } from '../engine/scenery.js';`.
- Constructor: replace `this.snow = new Snowfall();` with `this.highResolution = true;` and `this.time = 0;`.
- `update`: replace `this.snow.update(dt);` with `this.time += dt;`.
- `render`: replace the whole method with:

```js
  render(ctx) {
    drawVenueBackdrop(ctx, this.time);
    drawPanel(ctx, 120, 100, 400, 240);
    drawText(ctx, 'HARJOITTELU', 320, 124, { align: 'center', scale: 4, color: PALETTE.red });
    this.menu.render(ctx, 320, 192, { lineHeight: 28, scale: 2 });
  }
```

- [ ] **Step 5: Info scene**

In `game/scenes/infoScene.js`:
- Imports: replace the `draw.js` import with `import { drawBlinking, drawPanel } from '../engine/draw.js';` and add `import { drawVenueBackdrop } from '../engine/scenery.js';`.
- Constructor: replace `this.snow = new Snowfall();` with `this.highResolution = true;`.
- `update`: delete `this.snow.update(dt);` (`this.time += dt;` is already there).
- `render`: replace the whole method with:

```js
  render(ctx) {
    drawVenueBackdrop(ctx, this.time);
    drawPanel(ctx, 60, 72, 520, 360);
    drawText(ctx, this.title, 320, 96, { align: 'center', scale: 4, color: PALETTE.red });
    this.lines.forEach((line, index) => {
      drawText(ctx, line, 320, 156 + index * 24, { align: 'center', scale: 2, color: PALETTE.paper });
    });
    drawBlinking(ctx, this.prompt, 320, 400, this.time, { scale: 2, color: PALETTE.paperDim });
  }
```

- [ ] **Step 6: Pause scene**

In `game/scenes/pauseScene.js`:
- Imports: replace `import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/constants.js';` with `import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../engine/constants.js';`.
- Constructor: add `this.highResolution = true;` after `this.game = game;`.
- `render`: replace the whole method with:

```js
  render(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawPanel(ctx, 180, 160, 280, 180);
    drawText(ctx, 'TAUKO', 320, 184, { align: 'center', scale: 4, color: PALETTE.red });
    this.menu.render(ctx, 320, 236, { lineHeight: 28, scale: 2 });
  }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test tests/scenes/ tests/ui/ tests/flow.test.js`
Expected: PASS.

- [ ] **Step 8: Run the full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/scenes/titleScene.js game/scenes/practiceSelectScene.js game/scenes/infoScene.js game/scenes/pauseScene.js tests/scenes/menuScenes.test.js
git commit -m "feat: draw the title, practice, info and pause screens in the venue style

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Nickname and final results at full resolution

**Files:**
- Modify: `game/scenes/nicknameScene.js`, `game/scenes/finalScene.js`, `tests/scenes/menuScenes.test.js`

**Interfaces:**
- Consumes: as Task 3, plus the `fakeGame()` and `assertMenuStyle(scene, name)` helpers already defined in `tests/scenes/menuScenes.test.js` (Task 3); the new tests go in the same file.
- Produces: `NicknameScene` and `FinalScene` have `highResolution = true` and draw in canvas pixels; behaviour unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `tests/scenes/menuScenes.test.js` (add the two imports at the top):

```js
import { FinalScene } from '../../game/scenes/finalScene.js';
import { NicknameScene } from '../../game/scenes/nicknameScene.js';
```

```js
test('the nickname scene uses the new look in every state', () => {
  const scene = new NicknameScene({ game: fakeGame(), onConfirm() {}, onBack() {} });
  scene.update(1 / 60, fakeInput([]));
  assertMenuStyle(scene, 'nickname loading');
  scene.showList(['MATTI', 'LIISA']);
  assertMenuStyle(scene, 'nickname list');
  scene.state = 'entry';
  scene.entry.append('A');
  scene.message = 'NIMI ON VARATTU';
  const ctx = assertMenuStyle(scene, 'nickname entry');
  assert.ok(ctx.rects.some((r) => r.color === PALETTE.red), 'error message in red');
});

test('the final scene uses the new look', () => {
  const competition = {
    nickname: 'MATTI',
    eventIds: ['skiJump', 'slalom', 'luge'],
    eventResult: () => ({ points: 42 }),
    total: 126,
    toPayload: () => ({}),
  };
  const scene = new FinalScene({ game: fakeGame(), competition, onDone() {} });
  scene.update(1 / 60, fakeInput([]));
  assertMenuStyle(scene, 'final saving');
  scene.status = 'failed';
  const ctx = assertMenuStyle(scene, 'final failed');
  assert.ok(ctx.rects.some((r) => r.color === PALETTE.slateEdge && r.h === 2 && r.w === 440), 'divider');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/scenes/menuScenes.test.js`
Expected: FAIL — nickname and final scenes are not `highResolution`.

- [ ] **Step 3: Nickname scene**

In `game/scenes/nicknameScene.js`:
- Imports: replace the `draw.js` import with `import { drawBlinking, drawPanel } from '../engine/draw.js';` and add `import { drawVenueBackdrop } from '../engine/scenery.js';`.
- Constructor: replace `this.snow = new Snowfall();` with `this.highResolution = true;`.
- `update`: delete `this.snow.update(dt);`.
- `render`: replace the whole method with:

```js
  render(ctx) {
    drawVenueBackdrop(ctx, this.time);
    drawPanel(ctx, 100, 60, 440, 380);
    drawText(ctx, 'PELAAJA', 320, 84, { align: 'center', scale: 4, color: PALETTE.red });
    if (this.state === 'loading') {
      drawText(ctx, 'LADATAAN...', 320, 220, { align: 'center', scale: 2, color: PALETTE.paper });
    } else if (this.state === 'list') {
      drawText(ctx, 'VALITSE NIMI', 320, 132, { align: 'center', scale: 2, color: PALETTE.paperDim });
      this.menu.render(ctx, 320, 168, { lineHeight: 24, maxVisible: 9, scale: 2 });
    } else {
      drawText(ctx, 'KIRJOITA NIMI (MAX 10)', 320, 140, { align: 'center', scale: 2, color: PALETTE.paperDim });
      drawPanel(ctx, 180, 184, 280, 48);
      drawText(ctx, this.entry.value, 320, 200, { align: 'center', scale: 2, color: PALETTE.paper });
      drawBlinking(ctx, '_', 320 + this.entry.value.length * 6 + 8, 202, this.time, { scale: 2, color: PALETTE.red });
      drawText(ctx, 'ENTER = OK', 320, 264, { align: 'center', scale: 2, color: PALETTE.paper });
      if (this.message) drawText(ctx, this.message, 320, 300, { align: 'center', scale: 2, color: PALETTE.red });
    }
    drawText(ctx, 'ESC = TAKAISIN', 320, 412, { align: 'center', scale: 2, color: PALETTE.paperDim });
  }
```

- [ ] **Step 4: Final scene**

In `game/scenes/finalScene.js`:
- Imports: replace the `draw.js` import with `import { drawBlinking, drawPanel } from '../engine/draw.js';` and add `import { drawVenueBackdrop } from '../engine/scenery.js';`.
- Constructor: replace `this.snow = new Snowfall(90);` with `this.highResolution = true;`.
- `update`: delete `this.snow.update(dt);`.
- `render`: replace the whole method with:

```js
  render(ctx) {
    drawVenueBackdrop(ctx, this.time);
    drawPanel(ctx, 60, 40, 520, 420);
    drawText(ctx, 'LOPPUTULOKSET', 320, 64, { align: 'center', scale: 4, color: PALETTE.red });
    drawText(ctx, this.competition.nickname, 320, 112, { align: 'center', scale: 2, color: PALETTE.paperDim });
    this.competition.eventIds.forEach((eventId, index) => {
      const y = 156 + index * 28;
      drawText(ctx, EVENTS[eventId].name, 100, y, { scale: 2, color: PALETTE.paper });
      drawText(ctx, String(this.competition.eventResult(eventId).points), 540, y, { align: 'right', scale: 2, color: PALETTE.paper });
    });
    ctx.fillStyle = PALETTE.slateEdge;
    ctx.fillRect(100, 240, 440, 2);
    drawText(ctx, 'YHTEENSÄ', 100, 260, { scale: 4, color: PALETTE.red });
    drawText(ctx, String(this.competition.total), 540, 260, { align: 'right', scale: 4, color: PALETTE.red });
    const statusColor = this.status === 'failed' ? PALETTE.red : PALETTE.paper;
    drawText(ctx, STATUS_TEXT[this.status], 320, 332, { align: 'center', scale: 2, color: statusColor });
    if (this.status === 'failed') drawText(ctx, 'ENTER = YRITÄ UUDELLEEN', 320, 360, { align: 'center', scale: 2, color: PALETTE.paper });
    if (this.status !== 'saving') drawBlinking(ctx, 'VÄLILYÖNTI = VALIKKOON', 320, 420, this.time, { scale: 2, color: PALETTE.paperDim });
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/scenes/ tests/flow.test.js`
Expected: PASS.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/scenes/nicknameScene.js game/scenes/finalScene.js tests/scenes/menuScenes.test.js
git commit -m "feat: draw the nickname and final results screens in the venue style

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Browser check (controller)**

Run `npm run dev` and open `http://127.0.0.1:8080/`. Check: title (logo readable on the sky, hint readable on the snow), practice select, an info screen, the ski jump and the pause menu over it, slalom and the pause menu over it, the nickname screen (list and entry) and the final results. The backdrop drifts smoothly; the frame rate stays at 60 fps.
