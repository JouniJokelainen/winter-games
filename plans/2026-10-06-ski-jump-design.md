# Ski Jump (Mäkihyppy) – Design

Replaces the ski jump placeholder with a real event. Product rules: `docs/spec.md` (section "Mäkihyppy"). Event scene contract and constraints: `plans/2026-10-06-foundation.md`. Follow-ups picked up here: `plans/foundation-followups.md` (Ski jump section and "Ski jump and luge plans"). Structure follows the slalom event (`game/events/slalom/`).

## Rules

- **Phases:** ready → inrun → flight → landed or fallen. Space starts the inrun.
- **Wind:** tailwind only, drawn per jump from a uniform 0–4 m/s distribution (seeded RNG injected for tests). Tailwind raises inrun speed (longer jump) and narrows the takeoff window.
- **Takeoff:** the lip is marked on the inrun. Takeoff quality `q` in [0, 1]:
  - Space within the last 0.10 s before the lip → `q = 1`; at 4 m/s wind the full window narrows linearly to 0.06 s.
  - Earlier presses: `q` falls linearly from 1 at the window edge to 0 at 0.5 s before the lip. A press earlier than that, or no press at all → `q = 0` (short jump, lower speed; no fall).
  - The first Space press after the lip (during the first second of flight) is a late takeoff → the jump ends in a fall on the landing hill.
  - Takeoff adds upward velocity proportional to `q`.
- **Flight:** body angle θ measured from horizontal. Left arrow raises θ (more upright), right arrow lowers it (flatter). θ drifts upright by ≈6°/s, plus gusts whose strength scales with wind. Lift is greatest at θ = 45°; too upright or too flat adds drag, so the skier slows down and the jump is shorter.
- **Landing:** touchdown happens when the skier reaches the landing-hill profile. The last Space press before touchdown decides the landing:
  - more than 0.5 s before touchdown → poor landing (5 points)
  - 0.5–0.15 s before touchdown → perfect landing (20 points)
  - less than 0.15 s before touchdown, or no press → fall
  - presses during the inrun and the takeoff press do not count as landing presses
- **Distance:** horizontal distance from the lip to the touchdown point, one decimal, capped at 200 m. More than 200 m is impossible.
- **Points:** existing `skiJumpPoints(distance, landing)`. A fall is `valid: false`, 0 points, and keeps its distance for the summary.
- **Tuning targets (verified by bot tests):**
  - perfect jump at 4 m/s wind: 199–200 m
  - perfect jump in calm (0 m/s): 188–191 m
  - average jump (takeoff ≈0.3 s early, sloppy angle): 165–180 m
  - late takeoff: falls

## Physics (starting values, tuned by the bot tests)

- Units: metres and seconds; x grows to the right (downhill), y grows upward.
- Screen scale ≈1.2 px per metre. The whole hill fits the screen height; the camera follows horizontally only.
- **Inrun:** ≈35° slope; ≈4 s from start to lip; lip speed ≈88 km/h in calm and ≈95 km/h at 4 m/s.
- **Hill:** a polyline profile (inrun, lip, landing hill, outrun flat) in metres with `hillHeightAt(x)`. K-point at 170 m; the 200 m line marks the hill limit.

## Presentation

- **View:** side view, skier moves left to right at ≈40 % of the screen width.
- **Parallax background:** sky (static), distant mountains (0.2× camera speed), forest (0.5×), spectator rows below the landing hill and on the outrun (1.0×).
- **Hill:** inrun tower and track, lip, landing hill with a short marker every 10 m and numbers at 100, 150 and 200; K-point line blue; 200 m line red.
- **Skier:** pixel figure drawn in code. Poses: crouch (inrun), flight (body angle drawn in 15° steps), telemark (landing), fallen.
- **HUD:**
  - top left: speed in km/h, HYPPY n/3 (competition) or HARJOITUS n (practice)
  - during flight: `KULMA 47°` with a small indicator centred on 45°
  - top right: wind flag (pole and flag that rises toward horizontal as wind grows) and `TUULI 3,2 M/S`
  - after landing: large distance
- **Sounds:** `jump` on takeoff, `land` on a good landing, `crash` + `fail` on a fall, `tick` when the takeoff press hits the full window.
- **Result lines** (`attempt.summary`): `PITUUS 187,5 M`, `ALASTULO TÄYDELLINEN|HUONO|KAATUMINEN`, `TUULI 2,4 M/S`, `PISTEET n`.

## Architecture

New files in `game/events/skiJump/`:

- `hill.js`: hill profile polyline in metres, K-point and 200 m line, `hillHeightAt(x)`.
- `skiJumpSim.js`: pure rules and physics.
  - `createJumpState(hill, { wind, rng })`
  - `stepJump(state, controls, dt)` where `controls = { up: boolean, down: boolean, presses: number }`; `up` is the left arrow (more upright), `down` the right arrow (flatter), `presses` the Space presses this tick.
  - State: phase, position, velocity, angle, takeoff quality, landing result, distance, time, and the events of the latest step.
- `skiJumpRender.js`: parallax background, hill and markers, skier, wind flag, HUD.
- `skiJumpScene.js`: event scene contract. Draws the wind, holds ≈1 s at the end, then calls `onComplete(attempt)` with `{ valid, points, distance, summary }`.

Foundation changes:

- `drawText` rounds the y coordinate too.
- `skiJumpPoints` guards an unknown landing value; add tests for `LANDING_POINTS`.
- `tests/helpers/eventDrivers.js` gets a ski jump bot driver; `finishAttempt` in `tests/flow.test.js` also recognises the ski jump scene.
- `game/events/registry.js`: ski jump uses the real scene; luge stays a placeholder.

## Testing

- **Simulation unit tests:**
  - start on Space, and wind raises lip speed
  - takeoff quality inside the window, early, none, and late (fall)
  - angle drift and arrow keys
  - lift greatest at 45°
  - landing windows (>0.5 s, 0.5–0.15 s, <0.15 s, no press)
  - distance measurement and the 200 m cap
- **Bot tests:**
  - perfect at 4 m/s: 199–200 m
  - perfect in calm: 188–191 m
  - average: 165–180 m
  - late takeoff: falls
- **Scene tests:** `onComplete` called once after the hold; the attempt shape satisfies server validation; sounds.
- **Contract and flow tests:** drive the ski jump with its bot, so the server also receives a valid ski jump attempt.
- **Browser check:** in dev mode (`npm run dev`).
