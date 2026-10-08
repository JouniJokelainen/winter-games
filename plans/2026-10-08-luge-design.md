# Luge (Ohjaskelkkailu) – Design

Replaces the luge placeholder with a real event. Product rules: `suunnitelma.txt` (section "Ohjaskelkkailu"). Event scene contract: `plans/2026-10-06-foundation.md`. Pattern followed: `plans/2026-10-06-slalom-design.md`. Deferred items picked up here: `plans/foundation-followups.md` (Luge sections).

## Scope

- In scope: luge simulation, track, scene, driver for tests, registry hookup, and the pseudo-3D renderer already prototyped on `trial/luge-art` (`lugeTrack`, `lugeProjection`, `lugeSled`, `lugeRender`, palette additions). Those commits are brought into `feature/luge` and finished here.
- Not in scope: other events, menus, scoring rules (`lugePoints` and `bestAttempt` already exist).

## Rules

- **Push phase (5 s):** Space starts the run. The player taps Space as fast as possible; each press adds speed, and speed decays without pressing. The phase ends when the sled reaches the red line (`RED_LINE_S`), where the rider hops on automatically: strong tapping takes about 5 s (≈4.5 s), weak tapping longer, no tapping about 15 s (the runner keeps walking at 1 m/s). The push speed is the entry speed of the slope.
- **Slope:** the sled has track distance `s`, speed `v` and lateral position `lateral ∈ [-1, 1]` (−1 left rim, 0 centre, 1 right rim). Left/right arrows move `lateral`; Down brakes.
- **Turns (curvature `k`, positive = right):** `outer = −lateral · sign(k)` (a right turn, k > 0, has its outer side on the left, lateral < 0). `outer > 0` speeds the sled up, `outer < 0` slows it, centre keeps speed. The effect scales with `|k|`. On straights lateral position has no effect on speed. In a turn the sled also drifts toward the outer wall (`lateral −= driftGain · v² · k · dt`), so the player has to steer inward; the pull back to the centre exists only on straights. The safe speed depends on the position: `vSafe = √(A / |k|) · (1 + outerSafe · outer)`, higher on the outer side, lower on the inner side.
- **Crash (run rejected):** `|lateral| ≥ 1`, or `v > vSafe(k) = √(A / |k|)` in a turn. A crash ends the run with `valid: false`, 0 points, and the reason `OSUIT LAITAAN` (hit the rim) or `LIIAN KOVA VAUHTI` (too fast in a turn). A run still going after 45 s is also rejected (`AIKA YLITTYI`), so braking alone cannot finish a run.
- **Timing:** the clock starts when Space is pressed and stops at the finish line (`FINISH_S`); the push phase counts.
- **Points:** existing `lugePoints(time)` = 60 − 5 × started seconds over 30. Three runs; the fastest valid run counts (`bestAttempt`).
- **Track:** fixed, 10 turns, the hardest (k = 0.045) being turn 7 (prototype in `lugeTrack.js`), ending with a straight to the finish. Length and speed constants are tuned by the bot test so that a clean, well-driven run takes about 30 s.

## Physics (values tuned by the bot test)

- Push impulse 0.3 m/s per press, decay 0.8 m/s per second, floor 1 m/s, cap 4 m/s; gravity 9.3 m/s², drag 0.0022 /m; lateral rate 2.6 per second, return 0.4 per second on straights only; drift gain 0.025; turn gain 8 m/s² (at `|k| = 0.045`); brake 15 m/s²; `A = 48` (centre line ≈ 32.7 m/s ≈ 118 km/h in the tightest turn); `outerSafe = 0.4`; time limit 45 s.

## Presentation

- **Camera:** from behind the rider, pseudo-3D (prototype): U-shaped ice trough with rims, banking in turns, spectators and winter scenery. Distance is shown by scrolling the track.
- **Sled and rider:** rider lying head-first (style C), rolls with the wall under the sled; runner pushing in the push phase, red line on the ice.
- **HUD:** same bar as the other events: AIKA, speed in km/h with a bar, attempt label (`YRITYS n/3` or `HARJOITUS n`).
- **Banners:** `VÄLILYÖNTI = LÄHTÖ` (blinking), `MAALI!`, `HYLÄTTY`.
- **Sounds:** `push` on Space presses, `warning` (only when near the rim), `crash` and `fail` on a crash, `finish` at the finish. No continuous sound.
- **Result lines (`attempt.summary`):** `AIKA …`, `PISTEET n`; or for a crash `AIKA …`, `HYLÄTTY` and a reason line `OSUIT LAITAAN` (hit the rim), `LIIAN KOVA VAUHTI` (too fast in a turn) or `AIKA YLITTYI` (over the time limit).

## Architecture

New or finished files in `game/events/luge/`:

- `lugeTrack.js` – pure data and helpers: `TURNS`, `curvatureAt(s)`, `headingAt(s)`, `RED_LINE_S`, `FINISH_S`.
- `lugeSim.js` – pure rules and physics, no rendering or input:
  - `createLugeState()`
  - `stepLuge(state, controls, dt)` where `controls = { left, right, down, pushes }`
  - State: phase (`ready` | `pushing` | `running` | `finished` | `crashed`), `s`, `v`, `lateral`, `time`, crash reason, and a per-step events list (push / hop / crash / finish) used by sound and rendering.
- `lugeProjection.js`, `lugeSled.js`, `lugeRender.js` – from the trial branch; the renderer reads the state.
- `lugeScene.js` – implements the event scene contract: `wasPressed` to start, `pressCount('Space')` for pushes, `isDown` for arrows and Down, steps the sim, plays sounds from step events, renders, holds ≈ 1 s at the end, then calls `onComplete(attempt)`; `highResolution = true`.

Other changes:

- `game/events/registry.js`: luge uses `LugeScene`; the placeholder stays only for tests that need it.
- `tests/helpers/eventDrivers.js`: luge bot driver (`inputForEvent`); `tests/flow.test.js`: `finishAttempt` recognises `LugeScene`.
- `tests/core/scoring.test.js`: add the luge "faster but fewer points" `bestAttempt` test (follow-up).

## Testing

- `lugeSim` unit tests:
  - Space starts the push phase; presses accelerate up to the cap; speed decays without presses
  - the hop at the red line passes the push speed to the slope
  - outer side speeds up, inner side slows down, centre keeps speed in a turn
  - Down brakes
  - crash at `|lateral| ≥ 1` and at `v > vSafe(k)`
  - finish and time
- **Bot test:** an automatic driver runs the real track through `stepLuge` at 1/60 s:
  - good line (strong push, outer line 0.35): 28.5–30.5 s; centre line 30.5–33 s; average 33–36.5 s; no steering or braking alone: crash
- Render test: every phase renders with whole-pixel rects only and without the old retro colours.
- Event contract and flow tests keep passing; the server accepts luge attempts.
- Browser check in dev mode (`npm run dev`): a full run, a crash, the finish, the pause menu over luge, 60 fps.
