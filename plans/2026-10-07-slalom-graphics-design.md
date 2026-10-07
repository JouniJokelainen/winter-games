# Slalom Graphics (Pujottelu) – Design

Moves the slalom event to the realistic muted style of the ski jump (`plans/2026-10-06-ski-jump-design.md`, "Presentation") and the menus (`plans/2026-10-07-menu-graphics-design.md`), at the full 640×512 canvas. Product rules (`docs/spec.md`, "Pujottelu") are unchanged.

## Scope

- In scope: slalom rendering (`slalomRender.js`), a front-view skeleton skier, `highResolution` for `SlalomScene`, a shared skeleton rasteriser.
- Not in scope: slalom simulation, course, scoring, controls, sounds and texts; the camera keeps the same view (front view from above, the course scrolls up, the skier in the upper third). Gameplay must not change: `slalomSim.js`, `course.js` and the bot tests stay untouched.

## Architecture

- **`game/engine/skeleton.js` (new).** The rasteriser moves unchanged from `game/events/skiJump/skier.js`: `fillCapsule(ctx, ax, ay, bx, by, radius, colorAt)`, `solid(color)`, `shaded(light, dark, split)`, `transform(x, y, angle, [lx, ly])`. `skier.js` imports them. The ski jump must look exactly as before (render fingerprint identical before and after).
- **`game/events/slalom/slalomSkier.js` (new).** A front-view skier in style C (`SKIER_STYLES.classic` from `skier.js`): red helmet with pompom and goggles, blue suit with the white bib, red gloves, wooden skis, plus poles. `drawSlalomSkier(ctx, style, x, y, lean, fallen = false)` draws with the boots' midpoint at canvas (x, y); `lean` is the ski angle in radians (`state.angle`, −60°..60°, positive = moving right). Lean is continuous: the skis turn by `lean` in the screen plane, the body tilts into the turn (a fraction of `lean`) and the knees bend more the harder the turn. `fallen` draws the skier lying in the snow with skis crossed. About 40 px tall.
- **`slalomRender.js`** draws the whole scene in canvas pixels. World coordinates (simulation pixels, 320 wide) map to the canvas ×2 (`WORLD_SCALE = 2`), so the view covers the same area as today. `SKIER_SCREEN_Y` stays 70 in world units (140 on the canvas). The old sprite (`SKIER_SPRITES`, `skierPose`) is removed.
- **`SlalomScene`** sets `highResolution = true`; nothing else in the scene changes.
- Shared pieces reused: `drawPine` and `drawSnowfall` from `game/engine/scenery.js`, `drawBlinking`, `drawText`, the palette.

## Look (back to front)

- **Slope:** `snowLight` base with faint `snowMid` groomer lines every 32 canvas px that scroll with the course. Outside the fences the untouched snow is `snowMid`.
- **Track:** the skier's track as two thin `trackGroove` grooves.
- **Sides:** pines (`drawPine`, heights 40–60 px) on both edges with a short `shadow` cast down-right; spectators behind the fences in the muted ski jump colours (`suitPink`, `guide`, `wood2`, `pineLight`, `concrete1`), with heads in `skin` and a woolly hat, some waving (arm up on a 1 s cycle from the render `time`).
- **Fences:** net fences along both course edges: wooden posts (`wood3`/`wood6`) every 48 canvas px with a light net (`snowDark` mesh) between them.
- **Gates:** each pole a 4×28 px stick in `red` or `guide`-blue with a flag panel showing the arrow for the pass side, and a slanted `shadow` on the snow. A hit pole lies knocked over. Passed poles get a small `green` mark at the foot, missed ones a `red` cross (as today).
- **Start:** a wooden start hut (`wood*` walls, dark roof, open door) at the course start.
- **Finish:** two concrete timing posts (`concrete*`), a `red` banner with `MAALI` in `paper`, and a chequered finish line (`black`/`paper`).
- **Skier:** `drawSlalomSkier` with a soft `shadow` ellipse under the skis.
- **Snowfall:** `drawSnowfall(ctx, time)`.
- **HUD (as in the ski jump):** a 44 px `night` bar, text at scale 2: `AIKA` and speed with a speed bar (`darkGrey` track, `paper` fill) on the left, the attempt label in the middle (`skyLight`), `OSUMAT` and `OHITETUT x/2` on the right (`orange` when above 0).
- **Banners:** `VÄLILYÖNTI = LÄHTÖ` (blinking, scale 2, `night`), `MAALI!` (scale 4, `paper` with a `slate` shadow), `HYLÄTTY` (scale 4, `red` with a `black` shadow).

## Testing

- Ski jump render fingerprint identical before and after moving the rasteriser.
- `slalomSkier.test.js`: drawing with lean −1, 0, 1 and fallen produces only finite whole-pixel rects; with positive lean the ski tips (lowest ski pixels) are to the right of the boots, with negative lean to the left; fallen is wider than tall.
- `slalomRender.test.js`: every phase (ready, running with hits/passes/misses, finished, disqualified) renders without errors using only whole-pixel rects; none of the old retro colours (`yellow`, `ice`, `blue`, `navy`, `pine`, `brown`); pole shadows are drawn; the skier is drawn at canvas y ≈ 140.
- Existing slalom simulation, course, scene and bot tests keep passing unchanged.
- Browser check (`npm run dev`): a full slalom run, gate passes, hits, misses, a disqualification, the finish, the pause menu over slalom; 60 fps.
