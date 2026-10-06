# Slalom (Pujottelu) – Design

Replaces the slalom placeholder with a real event. Product rules: `docs/spec.md` (section "Pujottelu"). Event scene contract and constraints: `plans/2026-10-06-foundation.md`. Deferred items picked up here: `plans/foundation-followups.md` (Slalom section).

## Rules

- Fixed course, always the same: 20 single poles, alternating left/right of the course centerline, then a short pole-free straight (≈3 s) to the finish line.
- **Passing a pole:** every pole must be passed on its outer side, away from the course centerline (as in real slalom), so the skier has to weave. Red poles stand left of the centerline and are passed on their left side; blue poles stand right of it and are passed on their right side. Each pole flag shows a small arrow for the passing side. Passing on the wrong side = missed pole; a straight run down the middle misses every pole.
- **Hitting a pole:** knocks it down (stays down for the rest of the run), costs 10 points and slows the skier. Passing side is judged independently: hit + correct side = hit only; hit + wrong side = hit and missed pole.
- **Disqualification (immediate):** second missed pole, or crossing a course fence. The skier falls, "HYLÄTTY" is shown, and after ≈1 s the run ends.
- **Timing:** starts when the player presses Space to start, stops when the skier crosses the finish line.
- **Points:** existing `slalomPoints({ time, hits, missed })` = 60 − 5 × started seconds over 30 − 10 × hits − 20 × missed, floor 0. Disqualified run = `valid: false`, 0 points.
- **Course rhythm:** easy wide turns at the start, a tighter fast-rhythm middle section, a couple of steep offset turns where too much speed is punished, then the finish straight.
- **Target times:** an excellent run ≈ 30 s with 0 hits; an average run 33–36 s.

## Physics (starting values, tuned by the bot test)

- World units are pixels; y grows downhill. Course ≈200 px wide between fences, ≈5000 px long; poles at y ≈ 300–4400, finish line at y ≈ 4900.
- **Speed:** gravity accelerates; drag limits gravity-only speed to ≈130 px/s. Each Space press adds ≈+20 px/s; hard cap ≈220 px/s. Display km/h = px/s × 0.35 (≈77 km/h at the cap).
- **Steering:** ski angle θ in ±60° from straight downhill; velocity follows θ. Arrow keys rotate θ; turn rate drops with speed (≈half at the cap), so a too-fast skier cannot turn behind the next pole. On release θ returns toward 0. Speed loss proportional to |sin θ|.
- **Hit:** within ≈4 px of a pole → speed × 0.6, pole knocked down, hits + 1.
- **Pole check:** when the skier crosses a pole's y, compare x to the pole's x against the required side.
- **Finish:** after the finish line or disqualification, the scene holds ≈1 s before calling `onComplete`.

## Presentation

- **Camera:** front view. The skier stays in the upper third (screen y ≈ 70); the course scrolls up; ≈180 px of course is visible ahead. Vertical follow only; the course fits the 320 px screen width.
- **Scenery:** white slope, red-white fence posts on both sides, pines and rows of spectators outside the fences, start hut at the top, "MAALI" banner at the finish.
- **Poles:** red or blue pole with a flag arrow; knocked-down poles drawn tilted; passed poles get a green mark, missed poles a red cross.
- **Skier:** pixel figure ≈12×16 px seen from the front, poses straight / lean left / lean right / fallen; light ski tracks in the snow.
- **HUD (top):** AIKA, speed in km/h with a small bar, OSUMAT n, OHITETUT n/2, YRITYS n/3 (competition) or HARJOITUS n (practice).
- **Sounds:** `push` on Space presses, `hit` on pole hits, `warning` near a fence, `finish` at the finish, `crash` + `fail` on disqualification. No continuous ski sound.
- **Result lines** (`attempt.summary`): `AIKA …`, `OSUMAT n`, `OHITETUT KEPIT n`, then `PISTEET n` or `HYLÄTTY` plus the reason (`ULOS RADALTA` / `2 OHITETTUA KEPPIÄ`).

## Architecture

New files in `game/events/slalom/`:

- `course.js` – pure data: 20 poles `{ x, y, color }`, fence x-limits, finish y.
- `slalomSim.js` – pure rules and physics, no rendering or input:
  - `createSlalomState(course)`
  - `stepSlalom(state, controls, dt)` where `controls = { left: boolean, right: boolean, pushes: number }`
  - State: phase (`ready` | `running` | `finished` | `disqualified`), position, angle, speed, time, hits, missed, per-pole status, disqualification reason, and an events list for the step (hit / passed / missed / finish / disqualified) used by sound and rendering.
- `slalomRender.js` – draws scenery, fences, poles, skier, tracks and HUD from the state.
- `slalomScene.js` – implements the event scene contract: reads input (`wasPressed` to start, `pressCount('Space')` for pushes, `isDown` for arrows), steps the simulation with `dt`, plays sounds from step events, renders, holds ≈1 s at the end, then calls `onComplete(attempt)`.

Foundation changes:

- `game/engine/input.js`: presses are counted per tick; add `pressCount(code)`; `wasPressed` unchanged; guard `event.key`.
- `tests/helpers/fakeInput.js`: support held vs newly pressed keys and press counts.
- `game/events/registry.js`: slalom uses the real scene; ski jump and luge stay placeholders.
- `tests/core/scoring.test.js`: add the slalom time tie-break test.

## Testing

- Unit tests for `slalomSim`:
  - start on Space
  - turning slows the skier; pushes accelerate up to the cap
  - hit, passed and missed poles
  - immediate disqualification on the second missed pole and on crossing a fence
  - finish and time
- **Bot test:** an automatic driver runs the real course through `stepSlalom` at 1/60 s:
  - "excellent" line: 28–31 s, 0 hits
  - "average" line (later steering, fewer pushes): 33–36 s
  - "no steering": disqualified
- The existing event contract test keeps proving that the server accepts slalom attempts.
- Browser check in dev mode (`npm run dev`).
