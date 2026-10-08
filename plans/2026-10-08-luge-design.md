# Luge (Ohjaskelkkailu) – Design

Replaces the luge placeholder with a real event. Product rules: `suunnitelma.txt` (section "Ohjaskelkkailu"). Event scene contract: `plans/2026-10-06-foundation.md`. Pattern followed: `plans/2026-10-06-slalom-design.md`. Deferred items picked up here: `plans/foundation-followups.md` (Luge sections).

## Scope

- In scope: luge simulation, track, scene, driver for tests, registry hookup, and the pseudo-3D renderer already prototyped on `trial/luge-art` (`lugeTrack`, `lugeProjection`, `lugeSled`, `lugeRender`, palette additions). Those commits are brought into `feature/luge` and finished here.
- Not in scope: other events, menus, scoring rules (`lugePoints` and `bestAttempt` already exist).

## Rules

- **Push phase:** Space starts the run. The player taps Space; the sim averages the tapping rate (`tapSmooth` 0.4 s) and the push speed follows `tapRate × 1.78 m/s` (lag 0.3 s), clamped to 1–8 m/s, so about 4.5 taps per second already give the maximum start speed (3 taps/s 5.4 m/s in 4.2 s, 4 taps/s 7.0 m/s in 3.4 s, 5 taps/s 7.8 m/s in 3.0 s, 6 taps/s and more 8.0 m/s in 2.9 s). The phase ends when the sled reaches the red line (`RED_LINE_S`, 20 m from the start), where the rider hops on automatically. The push takes about 2.9 s at the maximum and about 20 s with one tap (the runner keeps walking at 1 m/s); the 45 s limit still applies to the whole run. The speed at the line is the entry speed of the slope.
- **Slope:** the sled has track distance `s`, speed `v` and lateral position `lateral ∈ [-1, 1]` (−1 left rim, 0 centre, 1 right rim). Left/right arrows move `lateral`; Down brakes.
- **Turns (curvature `k`, positive = right):** `outer = −lateral · sign(k)` (a right turn, k > 0, has its outer side on the left, lateral < 0). `outer > 0` speeds the sled up, `outer < 0` slows it, centre keeps speed. The effect scales with `|k|`. On straights lateral position has no effect on speed. In a turn the sled also drifts toward the outer wall (`lateral −= driftGain · v² · k · (1 − bankSupport · outer) · dt`), so the player has to steer inward; the pull back to the centre exists only on straights. The hold speed `√(lateralRate / (driftGain · |k| · (1 − bankSupport · outer)))` is the speed at which full steering still holds the line: 115 km/h on the centre line, 162 km/h on the outer side and 94 km/h on the inner side of the tightest turn. Above it the sled slides outward at the surplus rate.
- **Crash (run rejected):** A crash happens only when the sled reaches the rim (`|lateral| ≥ 1`, `SUISTUIT RADALTA`) or a run is still going after 45 s (`AIKA YLITTYI`). There is no separate speed limit: too much speed in a turn makes the outward slide stronger than the steering, so the sled slides up the outer wall and over the rim unless the player brakes in time. A crash ends the run with `valid: false` and 0 points.
- **Timing:** the clock starts when Space is pressed and stops at the finish line (`FINISH_S`); the push phase counts.
- **Points:** existing `lugePoints(time)` = 60 − 5 × started seconds over 30. Three runs; the fastest valid run counts (`bestAttempt`).
- **Deviations from `suunnitelma.txt` (on purpose):** push length (≈ 3 s instead of 5 s, by playtest), the clock includes the push, and there is no separate speed-crash rule (over-speed slides the sled over the rim).
- **Track:** fixed, 10 turns, the hardest (k = 0.045) being turn 7 (prototype in `lugeTrack.js`), ending with a straight to the finish. Length and speed constants are tuned by the bot test so that a clean, well-driven run takes about 30 s.

## Physics (values tuned by the bot test)

- `speedPerTap 1.78` m/s per tap per second, `tapSmooth 0.4` s, `pushLag 0.3` s, `pushMin 1` m/s, `pushMax 8` m/s; gravity 7 m/s², drag 0.0022 /m; lateral rate 3.2 per second, return 0.4 per second on straights only; drift gain 0.07; bank support 0.5; turn gain 8 m/s² (at `|k| = 0.045`); brake 22 m/s²; time limit 45 s.

## Presentation

- **Camera:** from behind the rider, pseudo-3D (prototype): U-shaped ice trough with rims, banking in turns, spectators and winter scenery. Distance is shown by scrolling the track.
- **Sled and rider:** rider lying head-first (style C), rolls with the wall under the sled; runner pushing in the push phase, red line on the ice.
- **Rider and runner (finished graphics):** an articulated figure whose pose model lives in `lugePose.js` (run cycle, 0.3 s hop onto the sled, lean in turns), with tapered limbs, three-tone shading and a number bib on the back panel. Joints are projected like the track, so perspective and the roll on the wall come for free.
- **Lines:** the start line, the hop band and the finish checker are smooth soft-edged lines painted by `lugeLines.js`.
- **Sky and forest:** `lugeSky.js` draws a misty gradient, clouds in three layers, a dim sun and three mountain ridges; `lugeForest.js` adds the layered forest in front of the haze.
- **Venue:** `lugeVenue.js` – stands at the start and the finish, spectator groups at the outer side of turns 3/5/7/9 with a 2-frame wave, and advertising boards reading `WINTER GAMES`.
- **Track details:** an icy rim lip, a darker inner wall, padding on the outer side of turns and an ice sheen.
- **Render budget:** In a real browser the frame cost is dominated by the number of fillRect calls (≈ 41k-54k per frame before optimisation); see `plans/2026-10-08-luge-performance.md`; target ≤ 16 ms per frame.
- **Racing line:** In practice mode a dashed orange racing line marks the recommended line: halfway from the centre to the outer rim in every turn (ramping in and out with the turn) and in the middle on straights. It is not shown in competitions. A bot that follows it finishes in ≈ 28.9 s and stays within |lateral| 0.6 of the centre.
- **HUD:** same bar as the other events: AIKA, speed in km/h with a bar, attempt label (`YRITYS n/3` or `HARJOITUS n`). The red marker shows the hold speed at the sled's current lateral position for the tightest turn within 120 m ahead (the speed the steering can still hold). A crashed sled slides over the outer rim during the hold.
- **Banners:** `VÄLILYÖNTI = LÄHTÖ` (blinking), `NAPUTA VÄLILYÖNTIÄ!` in the push phase, `MAALI!`, `HYLÄTTY`.
- **Sounds:** `push` on Space presses, `warning` (only when near the rim), `crash` and `fail` on a crash, `finish` at the finish. No continuous sound.
- **Result lines (`attempt.summary`):** `AIKA …`, `PISTEET n`; or for a crash `AIKA …`, `HYLÄTTY` and a reason line `SUISTUIT RADALTA` (slid over the rim) or `AIKA YLITTYI` (over the time limit).

## Architecture

New or finished files in `game/events/luge/`:

- `lugeTrack.js` – pure data and helpers: `TURNS`, `curvatureAt(s)`, `headingAt(s)`, `RED_LINE_S`, `FINISH_S`.
- `lugeSim.js` – pure rules and physics, no rendering or input:
  - `createLugeState()`
  - `stepLuge(state, controls, dt)` where `controls = { left, right, down, pushes }`
  - State: phase (`ready` | `pushing` | `running` | `finished` | `crashed`), `s`, `v`, `lateral`, `time`, crash reason, and a per-step events list (start / hop / crash / finish) used by sound and rendering.
- `lugeProjection.js`, `lugeSled.js`, `lugeRender.js` – from the trial branch; the renderer reads the state.
- `lugePose.js` – pure articulated poses (run, hop, lie) by forward kinematics and two-bone arm IK.
- `lugeLines.js` – smooth soft-edged start, hop and finish lines painted over the ice.
- `lugeSky.js` – gradient, sun, clouds and mountain ridges.
- `lugeForest.js` – layered forest backdrop and the near pines.
- `lugeVenue.js` – stands, spectators and advertising boards.
- `lugeScene.js` – implements the event scene contract: `pressCount('Space')` for the start and the pushes, `isDown` for arrows and Down, steps the sim, plays sounds from step events, renders, holds ≈ 1 s at the end, then calls `onComplete(attempt)`; `highResolution = true`.

Other changes:

- `game/events/registry.js`: luge uses `LugeScene`; the placeholder stays only for tests that need it.
- `tests/helpers/eventDrivers.js`: luge bot driver (`inputForEvent`); `tests/flow.test.js`: `finishAttempt` recognises `LugeScene`.
- `tests/core/scoring.test.js`: add the luge "faster but fewer points" `bestAttempt` test (follow-up).

## Testing

- `lugeSim` unit tests:
  - Space starts the push phase; tapping raises the push speed up to the cap; it falls back without taps
  - more taps give more start speed up to the maximum; about 4–5 taps per second are enough for most of it; tapping faster (12 per second) adds nothing, tapping slowly (3 per second) costs about 1.7 s (relative to the good line)
  - the hop at the red line passes the push speed to the slope
  - outer side speeds up, inner side slows down, centre keeps speed in a turn
  - Down brakes
  - crash at `|lateral| ≥ 1`; too much speed slides the sled over the outer rim, speed alone is never a crash
  - finish and time
- **Bot test:** an automatic driver runs the real track through `stepLuge` at 1/60 s:
  - good line (8.6 taps/s, outer line 0.35): 28.5–30.5 s (≈ 29.7); centre line 30.5–33 s (≈ 31.5); average (3 taps/s) 33–36.5 s (≈ 35.0); careless player (wide tolerance 0.12, short look-ahead 50 m) finishes 30–34 s (≈ 31.4); lazy (3 taps/s) ≈ 1.7 s slower than good; no steering or braking alone: crash; steering without braking slides over the rim at turn 7
  - line bot (follows the marked racing line): 28–30.5 s, widest |lateral| < 0.75
- Pose tests (`lugePose.test.js`): bone lengths stay fixed through the run cycle and the hop, the hop ends in the lying pose.
- Render frame tests (`lugeRender.test.js`): every frame type draws whole-pixel rects; the sky is deterministic, slides with the heading and drifts with the clock.
- PNG harness: before/after PNGs of key frames are rendered for visual review into the git-ignored `.superpowers/shots`.
- Event contract and flow tests keep passing; the server accepts luge attempts.
- Browser check in dev mode (`npm run dev`): a full run, a crash, the finish, the pause menu over luge, 60 fps.
