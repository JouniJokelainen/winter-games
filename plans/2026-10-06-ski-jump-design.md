# Ski Jump (Mäkihyppy) – Design

Replaces the ski jump placeholder with a real event. Product rules: `docs/spec.md` (section "Mäkihyppy"). Event scene contract and constraints: `plans/2026-10-06-foundation.md`. Follow-ups picked up here: `plans/foundation-followups.md` (Ski jump section and "Ski jump and luge plans"). Structure follows the slalom event (`game/events/slalom/`).

## Rules

- **Phases:** ready → inrun → flight → landed or fallen. Space starts the inrun.
- **Wind:** tailwind only, drawn per jump from a uniform 0–4 m/s distribution (seeded RNG injected for tests). Tailwind raises inrun speed (longer jump) and narrows the takeoff window.
- **Takeoff:** the lip is marked on the inrun. Takeoff quality `q` in [0, 1]:
  - Space within the last 0.10 s before the lip → `q = 1`; at 4 m/s wind the full window narrows linearly to 0.06 s.
  - Earlier presses: `q` falls linearly from 1 at the window edge to 0 at 0.5 s before the lip. Presses earlier than 0.5 s are ignored, so the player can still time the real takeoff; no takeoff press at all → `q = 0` (short jump, lower speed; no fall).
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
  - average jump (takeoff ≈0.22 s early, angle held at 48° ± 5°): 165–180 m
  - late takeoff: falls

## Physics (starting values, tuned by the bot tests)

- Units: metres and seconds; x grows to the right (downhill), y grows upward; the lip is at (0, 0).
- **Inrun:** 53 m long: a straight 35° ramp that curves (radius 40 m) into the 11° takeoff table. The skier follows the curve; speed grows at a constant rate (gravity along 35° plus tailwind), so the lip speed and timing do not depend on the curve. ≈4.3 s from start to lip; lip speed ≈88 km/h in calm and ≈91 km/h at 4 m/s.
- **Hill:** landing-hill polyline in metres with `hillHeightAt(x)`; the slope flattens after ≈190 m, so the longest jumps stay near 200 m. K-point at 170 m; the 200 m line marks the hill limit.
- **Flight:** lift and drag grow with speed²; the body angle's efficiency `cos(2(θ − 45°))` scales lift (min 90 %) and drag. Constants in `JUMP_CONFIG`, locked by the bot tests.

## Presentation

Look-and-feel was settled in a browser trial (`trial/ski-jump-art` branch) against the user's reference screenshots (`reference/skijump*.png`, kept out of git).

- **Resolution:** the whole game canvas becomes 640×512. Menus, slalom and other existing scenes keep drawing in 320×256 logical pixels and are scaled ×2 by the scene manager; the ski jump scene sets `highResolution = true` and draws 1:1 at 640×512. Existing scenes move to full resolution in a later graphics pass.
- **Style:** realistic, muted winter colours (misty grey-lavender sky, browns, concrete greys, dark greens), new keys in the shared `PALETTE`. Existing palette keys are unchanged.
- **Camera:** close to the skier (16 px per metre, ≈40 m visible). It follows the skier both ways: centred on the inrun, then over ≈1.2 s after the lip it moves the skier to the upper left so the slope ahead stays visible. It stops at the end of the outrun.
- **Background (parallax):** banded misty sky; a distant snowy ridge (0.08× camera speed); two layers of pine trees (0.25× and 0.55×); snowfall.
- **Inrun:** a 3D-looking wooden slab: dark far rail, icy track with grooves, lit near edge, then a tall side face in eight wood shades with dithered band edges; start platform at the top; end faces at the takeoff table. Concrete pillars under the inrun and a wide concrete wall under the takeoff table with its shadow on the snow.
- **Landing hill:** snow with a dark surface line, a blue guide rope 1.2 m above the surface with dark joints every 10 m and numbers at 100, 150 and 200; K-point green post, 200 m red post; spectators along the lower hill and outrun.
- **Skier (style C, "80s"):** drawn from a skeleton (boots, knees, hips, shoulders, hands, head) as thick capsules rasterised per frame in the final angle, so rotation stays crisp. Red helmet with red pompom and goggles, blue suit with white back and bib, red gloves, wooden skis. Bindings at the middle of the skis (telemark slightly behind the middle). Poses: crouch on the inrun (thighs level, chest on knees, arms back), V-style flight (arms back at the hips, skis open in a V below the body), telemark landing (one foot forward, arms out), fallen (tumbling).
- **Shadow:** the skier's body and both skis are projected straight down onto the landing hill. High up the shadow is light and sparse (ordered dither); below ≈4 m it is dark and solid, which helps time the landing.
- **HUD (text ×2):**
  - top left: speed in km/h, HYPPY n/3 (competition) or HARJOITUS n (practice)
  - during flight: `KULMA 47°` with an indicator centred on 45°
  - top right: wind flag (rises toward horizontal as wind grows) and `TUULI 3,2 M/S`
  - after landing: large distance; after a fall: `KAATUMINEN`
- **Sounds:** `jump` on takeoff, `tick` when the takeoff press hits the full window, `land` on a good landing, `crash` + `fail` on a fall.
- **Result lines** (`attempt.summary`): `PITUUS 187,5 M`, `ALASTULO TÄYDELLINEN|HUONO|KAATUMINEN`, `TUULI 2,4 M/S`, `PISTEET n`.

## Architecture

New files in `game/events/skiJump/`:

- `hill.js`: `HILL` (curved inrun path, landing-hill profile, K-point, 200 m line), `hillHeightAt(hill, x)`, `inrunPointAt(hill, distance)`, `inrunHeightAt(hill, x)`.
- `skiJumpSim.js`: pure rules and physics.
  - `createJumpState(hill, { wind, rng })`
  - `stepJump(state, controls, dt)` where `controls = { up: boolean, down: boolean, presses: number }`; `up` is the left arrow (more upright), `down` the right arrow (flatter), `presses` the Space presses this tick.
  - Helpers: `takeoffQuality`, `angleEfficiency`, `classifyLanding`, `isJumpActive`.
- `skier.js`: skeleton skier (`SKIER_STYLES.classic`, `POSES`, `drawSkier`, `skierSilhouette`).
- `skiJumpRender.js`: camera, background, inrun, hill, skier, shadow, HUD.
- `skiJumpScene.js`: event scene contract (`highResolution = true`). Draws the wind, holds ≈1 s at the end, then calls `onComplete(attempt)` with `{ valid, points, distance, landing, summary }`.

Foundation changes:

- 640×512 canvas: `CANVAS_WIDTH`, `CANVAS_HEIGHT`, `RESOLUTION_SCALE` in `constants.js`; `screen.js` sizes the canvas; `SceneManager.render` sets the transform per scene (×2 for low-resolution scenes, 1:1 for `highResolution` scenes).
- New muted-style keys in `PALETTE` (existing keys unchanged).
- `drawText` rounds the y coordinate too.
- `skiJumpPoints` rejects an unknown landing value; tests for `LANDING_POINTS`.
- `tests/helpers/eventDrivers.js` gets a ski jump bot driver; `finishAttempt` in `tests/flow.test.js` also recognises the ski jump scene.
- `game/events/registry.js`: ski jump uses the real scene; luge stays a placeholder.

## Testing

- **Foundation:** canvas constants and palette keys; scene manager transforms; text rounding; landing guard.
- **Hill:** landing profile; inrun path starts at the top, curves from 35° to 11° and ends exactly at the lip.
- **Simulation unit tests:**
  - start on Space, and wind raises lip speed
  - takeoff quality inside the window, early (ignored before 0.5 s), none, and late (fall)
  - angle drift, gusts and arrow keys
  - lift greatest at 45°
  - landing windows (>0.5 s, 0.5–0.15 s, <0.15 s, no press)
  - distance measurement, the 200 m cap and sliding after touchdown
- **Bot tests:**
  - perfect at 4 m/s: 199–200 m
  - perfect in calm: 188–191 m
  - average: 165–180 m
  - late takeoff: falls
- **Skier:** every pose draws skis, suit and helmet colours; helmet fully red; bindings at the ski middle; V-shaped skis in flight; silhouette rotates.
- **Render:** camera keeps the skier on screen and moves it to the upper left in flight; every phase renders; the shadow is denser and darker near the ground.
- **Scene tests:** `onComplete` called once after the hold; the attempt shape satisfies server validation; sounds.
- **Contract and flow tests:** drive the ski jump with its bot, so the server also receives a valid ski jump attempt.
- **Browser check:** in dev mode (`npm run dev`).
