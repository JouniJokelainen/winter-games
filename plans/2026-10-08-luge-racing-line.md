# Luge: a marked racing line in practice – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark the recommended driving line on the ice: a dashed line that runs on the outer side of every turn and in the middle on the straights. It is shown in practice mode only, not in competitions.

**Architecture:** `lugeTrack.js` gets `racingLineAt(s)` (the line's lateral position, built from the same trapezoid weights as the turns); the renderer draws it per row like the runner grooves; the scene turns it on for practice. A bot that follows the line pins its balance.

**Tech Stack:** Plain ES modules, `node --test`. No new packages.

## Global Constraints

- Code and comments in English. No new packages. Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Renderer rects must be whole pixels and must not use the old retro colours (`yellow`, `ice`, `blue`, `navy`, `pine`, `brown`). The line colour is `PALETTE.orange`.
- Work in `.worktrees/luge` (branch `feature/luge`).

## The line

`racingLineAt(s) = −Σ sign(turn.k) · 0.5 · weight(s, turn)` over the turns (lateral units, negative = left): halfway from the centre to the outer rim in every turn, ramping in and out with the turn, 0 on straights. A right turn (k > 0) has its outer side on the left.

Measured: a bot steering exactly along this line (deadband 0.04, braking to the hold speed at outer = 0.5) finishes in 28.94 s and never goes beyond |lateral| 0.59 (0.67 with a 0.12 tolerance), so the line gives full points with a safety margin to the rim.

---

### Task 1: Racing line

**Files:**
- Modify: `game/events/luge/lugeTrack.js`, `game/events/luge/lugeSled.js`, `game/events/luge/lugeRender.js`, `game/events/luge/lugeScene.js`
- Modify: `tests/helpers/lugeBot.js`
- Test: `tests/events/luge/lugeTrack.test.js`, `tests/events/luge/lugeRender.test.js`, `tests/events/luge/bot.test.js`, `tests/events/luge/lugeScene.test.js`
- Modify: `plans/2026-10-08-luge-design.md`

**Interfaces:**
- Produces: `RACING_LINE_OUTER = 0.5` and `racingLineAt(s: number): number` from `lugeTrack.js`; `SLED_X_RANGE` exported from `lugeSled.js` (metres from the centre line at lateral = ±1, value `1.9`); render view field `showLine?: boolean`; bot profile `line` with `followLine: true`.

- [ ] **Step 1: Failing tests**

a) Append to `tests/events/luge/lugeTrack.test.js` (add `racingLineAt` and `RACING_LINE_OUTER` to its import from `lugeTrack.js`):

```js
test('the racing line is on the outer side of every turn and in the middle on the straights', () => {
  assert.equal(racingLineAt(0), 0);
  assert.equal(racingLineAt(FINISH_S), 0);
  for (const turn of TURNS) {
    const mid = racingLineAt(turn.at + turn.length / 2);
    assert.equal(Math.sign(mid), -Math.sign(turn.k), `turn at ${turn.at}`);
    assert.ok(Math.abs(Math.abs(mid) - RACING_LINE_OUTER) < 1e-9);
    assert.equal(racingLineAt(turn.at), 0);
  }
});
```

b) Append to `tests/events/luge/lugeRender.test.js`:

```js
test('the racing line is drawn in orange dashes only when asked for', () => {
  const orange = (view) => {
    const ctx = recordingCtx();
    renderLuge(ctx, view);
    for (const r of ctx.rects) assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), JSON.stringify(r));
    return ctx.rects.filter((r) => r.color === PALETTE.orange).length;
  };
  const view = { ...BASE, s: 120 }; // inside the first turn
  assert.ok(orange({ ...view, showLine: true }) > orange(view) + 20);
});
```

c) Append to `tests/events/luge/bot.test.js` (it already imports `createLugeState`, `stepLuge`, `BOTS`; add `botControls` to the import from `../../helpers/lugeBot.js` if it is not there yet):

```js
test('a bot that follows the marked racing line finishes in about 29 s with a safe margin to the rim', () => {
  const state = createLugeState();
  let widest = 0;
  for (let tick = 0; tick < 60 * 120 && state.phase !== 'crashed' && state.phase !== 'finished'; tick++) {
    stepLuge(state, botControls(state, BOTS.line, tick), DT);
    if (state.phase === 'running') widest = Math.max(widest, Math.abs(state.lateral));
  }
  assert.equal(state.phase, 'finished');
  assert.ok(state.time > 28 && state.time < 30.5, `line took ${state.time}`);
  assert.ok(widest < 0.75, `widest lateral ${widest}`);
});
```

d) Append to `tests/events/luge/lugeScene.test.js` (import `PALETTE` from `../../../game/engine/palette.js` there if it is not imported yet):

```js
test('the racing line is shown in practice and hidden in a competition', () => {
  const lineRects = (mode) => {
    const { scene } = makeScene({ mode });
    Object.assign(scene.state, { phase: 'running', s: 120, v: 30 });
    const ctx = recordingCtx();
    scene.render(ctx);
    return ctx.rects.filter((r) => r.color === PALETTE.orange).length;
  };
  assert.ok(lineRects('practice') > lineRects('competition') + 20);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/events/luge`
Expected: FAIL (`racingLineAt` is not exported, `BOTS.line` is undefined, no orange rects).

- [ ] **Step 3: Track**

In `game/events/luge/lugeTrack.js` append (the file already has the private `weight(s, turn)`):

```js
// The recommended line: halfway from the centre to the outer rim in every turn (a right turn has its outer side on
// the left, lateral < 0), ramping in and out with the turn, in the middle on the straights.
export const RACING_LINE_OUTER = 0.5;

export function racingLineAt(s) {
  let line = 0;
  for (const turn of TURNS) line -= Math.sign(turn.k) * RACING_LINE_OUTER * weight(s, turn);
  return line;
}
```

- [ ] **Step 4: Renderer and scene**

a) In `game/events/luge/lugeSled.js` change `const SLED_X_RANGE = 1.9;` to `export const SLED_X_RANGE = 1.9;`.

b) In `game/events/luge/lugeRender.js`: import `SLED_X_RANGE` from `./lugeSled.js` (extend the existing import of `drawRunner, drawSledAndRider`) and `racingLineAt` from `./lugeTrack.js` (extend the existing import). Define `const LINE_DASH = 1.5; // metres per dash and per gap` and `const LINE_WIDTH = 0.1; // metres` next to the other module constants (near `FOG_START`). In `drawRows`, right after the loop that draws the two runner grooves (`for (const groove of [-0.9, 0.9]) { ... }`), add:

```js
      if (view.showLine) {
        const along = s + z;
        if (Math.floor(along / LINE_DASH) % 2 === 0) {
          const x = racingLineAt(along) * SLED_X_RANGE;
          const zl = ((CAM_H - profileHeight(x, bank)) * FOCAL) / dy;
          const sx = W / 2 + (sample(look.L, zl) + x) * (FOCAL / zl);
          const width = Math.max(1, Math.round((LINE_WIDTH * FOCAL) / zl));
          fillRow(ctx, sx - width / 2, sx + width / 2, y, tint(PALETTE.orange));
        }
      }
```
(`fillRow` rounds its arguments, so the rects stay whole pixels.)

c) In `game/events/luge/lugeScene.js`: in the constructor add `this.showLine = mode !== 'competition';` and in `render()` add `showLine: this.showLine,` to the view object.

- [ ] **Step 5: Bot helper**

In `tests/helpers/lugeBot.js` import `racingLineAt` from `../../game/events/luge/lugeTrack.js` (extend the existing import of `curvatureAt`), add the profile

```js
  line: { pushEvery: 7, look: 120, margin: 0.97, outer: 0.5, dead: 0.04, followLine: true },
```
to `BOTS`, and in `botControls` replace the `target` computation with:

```js
  const target = profile.followLine
    ? racingLineAt(state.s)
    : (Math.abs(k) > TURN_CURVATURE ? -Math.sign(k) * profile.outer : 0);
```
(keep the rest unchanged; extend the comment above `BOTS` with `followLine: steer along the marked racing line instead of a fixed share of the outer side`).

- [ ] **Step 6: Run the luge tests**

Run: `node --test tests/events/luge`
Expected: all pass (line bot ≈ 28.9 s, widest lateral ≈ 0.59). If the render/scene test finds no orange rects, check that the first turn is in view at `s: 120` and report; do not weaken the test.

- [ ] **Step 7: Design document**

In `plans/2026-10-08-luge-design.md`, Presentation: add "In practice mode a dashed orange racing line marks the recommended line: halfway from the centre to the outer rim in every turn (ramping in and out with the turn) and in the middle on straights. It is not shown in competitions. A bot that follows it finishes in ≈ 28.9 s and stays within |lateral| 0.6 of the centre." Testing: add the line bot.

- [ ] **Step 8: Full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/events/luge tests plans/2026-10-08-luge-design.md plans/2026-10-08-luge-racing-line.md
git commit -m "feat: mark the recommended racing line on the luge track in practice

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
