# Luge (Ohjaskelkkailu) – Design

Replaces the luge placeholder with a real event. Product rules: `suunnitelma.txt` (section "Ohjaskelkkailu"). Event scene contract: `plans/2026-10-06-foundation.md`. Pattern followed: `plans/2026-10-06-slalom-design.md`. Deferred items picked up here: `plans/foundation-followups.md` (Luge sections).

## Scope

- In scope: luge simulation, track, scene, driver for tests, registry hookup, and the pseudo-3D renderer already prototyped on `trial/luge-art` (`lugeTrack`, `lugeProjection`, `lugeSled`, `lugeRender`, palette additions). Those commits are brought into `feature/luge` and finished here.
- Not in scope: other events, menus, scoring rules (`lugePoints` and `bestAttempt` already exist).

## Rules

- **Push phase:** Space starts the run. The player taps Space; the sim averages the tapping rate (`tapSmooth` 0.4 s) and the push speed follows `tapRate × 1.3 m/s` (lag 0.3 s), clamped to 1–8 m/s, so 6–8 taps per second already give the maximum start speed (6 taps/s 7.5 m/s, 8.6 taps/s 8.0 m/s, 4 taps/s 5.3 m/s). The phase ends when the sled reaches the red line (`RED_LINE_S`, 20 m from the start), where the rider hops on automatically. The push takes about 2.9 s at the maximum, 4.4 s at 4 taps/s and about 20 s with no tapping (the runner keeps walking at 1 m/s); the 45 s limit still applies to the whole run. The speed at the line is the entry speed of the slope.
- **Slope:** the sled has track distance `s`, speed `v` and lateral position `lateral ∈ [-1, 1]` (−1 left rim, 0 centre, 1 right rim). Left/right arrows move `lateral`; Down brakes.
- **Turns (curvature `k`, positive = right):** `outer = −lateral · sign(k)` (a right turn, k > 0, has its outer side on the left, lateral < 0). `outer > 0` speeds the sled up, `outer < 0` slows it, centre keeps speed. The effect scales with `|k|`. On straights lateral position has no effect on speed. In a turn the sled also drifts toward the outer wall (`lateral −= driftGain · v² · k · (1 − bankSupport · outer) · dt`), so the player has to steer inward; the pull back to the centre exists only on straights. The hold speed `√(lateralRate / (driftGain · |k| · (1 − bankSupport · outer)))` is the speed at which full steering still holds the line: 115 km/h on the centre line, 162 km/h on the outer side and 94 km/h on the inner side of the tightest turn. Above it the sled slides outward at the surplus rate.
- **Crash (run rejected):** A crash happens only when the sled reaches the rim (`|lateral| ≥ 1`, `SUISTUIT RADALTA`) or a run is still going after 45 s (`AIKA YLITTYI`). There is no separate speed limit: too much speed in a turn makes the outward slide stronger than the steering, so the sled slides up the outer wall and over the rim unless the player brakes in time. A crash ends the run with `valid: false` and 0 points.
- **Timing:** the clock starts when Space is pressed and stops at the finish line (`FINISH_S`); the push phase counts.
- **Points:** existing `lugePoints(time)` = 60 − 5 × started seconds over 30. Three runs; the fastest valid run counts (`bestAttempt`).
- **Track:** fixed, 10 turns, the hardest (k = 0.045) being turn 7 (prototype in `lugeTrack.js`), ending with a straight to the finish. Length and speed constants are tuned by the bot test so that a clean, well-driven run takes about 30 s.

## Physics (values tuned by the bot test)

- `speedPerTap 1.3` m/s per tap per second, `tapSmooth 0.4` s, `pushLag 0.3` s, `pushMin 1` m/s, `pushMax 8` m/s; gravity 7 m/s², drag 0.0022 /m; lateral rate 3.2 per second, return 0.4 per second on straights only; drift gain 0.07; bank support 0.5; turn gain 8 m/s² (at `|k| = 0.045`); brake 22 m/s²; time limit 45 s.

## Presentation

- **Camera:** from behind the rider, pseudo-3D (prototype): U-shaped ice trough with rims, banking in turns, spectators and winter scenery. Distance is shown by scrolling the track.
- **Sled and rider:** rider lying head-first (style C), rolls with the wall under the sled; runner pushing in the push phase, red line on the ice.
- **Racing line:** In practice mode a dashed orange racing line marks the recommended line: halfway from the centre to the outer rim in every turn (ramping in and out with the turn) and in the middle on straights. It is not shown in competitions. A bot that follows it finishes in ≈ 28.9 s and stays within |lateral| 0.6 of the centre.
- **HUD:** same bar as the other events: AIKA, speed in km/h with a bar, attempt label (`YRITYS n/3` or `HARJOITUS n`). The red marker shows the hold speed at the sled's current lateral position for the tightest turn within 120 m ahead (the speed the steering can still hold). A crashed sled slides over the outer rim during the hold.
- **Banners:** `VÄLILYÖNTI = LÄHTÖ` (blinking), `MAALI!`, `HYLÄTTY`.
- **Sounds:** `push` on Space presses, `warning` (only when near the rim), `crash` and `fail` on a crash, `finish` at the finish. No continuous sound.
- **Result lines (`attempt.summary`):** `AIKA …`, `PISTEET n`; or for a crash `AIKA …`, `HYLÄTTY` and a reason line `SUISTUIT RADALTA` (slid over the rim) or `AIKA YLITTYI` (over the time limit).

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
  - Space starts the push phase; tapping raises the push speed up to the cap; it falls back without taps
  - more taps give more start speed up to the maximum; 6–8 taps per second are enough for it; tapping faster (12 per second) adds nothing, tapping slowly (4 per second) costs about 1.7 s (relative to the good line)
  - the hop at the red line passes the push speed to the slope
  - outer side speeds up, inner side slows down, centre keeps speed in a turn
  - Down brakes
  - crash at `|lateral| ≥ 1`; too much speed slides the sled over the outer rim, speed alone is never a crash
  - finish and time
- **Bot test:** an automatic driver runs the real track through `stepLuge` at 1/60 s:
  - good line (8.6 taps/s, outer line 0.35): 28.5–30.5 s (≈ 29.8); centre line 30.5–33 s (≈ 31.6); average 33–36.5 s (≈ 34.9); careless player (wide tolerance 0.12, short look-ahead 50 m) finishes 30–34 s (≈ 31.5); no steering or braking alone: crash; steering without braking slides over the rim at turn 7
  - line bot (follows the marked racing line): 28–30.5 s, widest |lateral| < 0.75
- Render test: every phase renders with whole-pixel rects only and without the old retro colours.
- Event contract and flow tests keep passing; the server accepts luge attempts.
- Browser check in dev mode (`npm run dev`): a full run, a crash, the finish, the pause menu over luge, 60 fps.
