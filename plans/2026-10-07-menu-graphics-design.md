# Menu Graphics (Valikot) – Design

Moves the menu scenes to the realistic muted style of the ski jump (`plans/2026-10-06-ski-jump-design.md`, "Presentation") and to the full 640×512 canvas. Slalom keeps its current look; it gets its own graphics pass later.

## Scope

- Scenes: `titleScene`, `infoScene`, `pauseScene`, `practiceSelectScene`, `nicknameScene`, `finalScene` (all in `game/scenes/`).
- Shared UI: `drawPanel` and `drawBlinking` (`game/engine/draw.js`), `Menu` (`game/ui/menu.js`).
- Not in scope: slalom and placeholder event scenes, game flow, menu behaviour, texts, sounds.

## Architecture

- **`game/engine/scenery.js` (new, 640×512 canvas pixels).** The ski jump's landscape helpers move here unchanged and `skiJumpRender.js` imports them: misty banded sky with the distant snowy ridge, `drawPine`, forest layers, snowfall. Their signatures keep the camera/offset parameters the ski jump uses. The ski jump must look exactly as before.
- **`drawVenueBackdrop(ctx, time)` (new, in `scenery.js`).** The menu backdrop: misty sky and ridge, two pine layers, a small distant ski jump silhouette (wooden inrun in `wood*` shades on `concrete*` pillars) and a snowy plain in front, with snowfall. The ridge and forest layers drift sideways slowly with `time` (≈6 px/s for the nearest layer, slower further back) and wrap seamlessly. Pure function of `time`; no state.
- **Menu scenes draw at full resolution.** Each of the six scenes sets `highResolution = true`. Coordinates are doubled and text uses `scale` ×2 (titles ×4, the title logo ×8), so on-screen sizes stay as they are today. Each scene keeps a `time` (from `dt`) for the backdrop and blinking.
- **Pause overlay.** `pauseScene` becomes high-res too; the scene manager already sets the transform per scene, so it works over both the low-res slalom and the high-res ski jump.
- **Kept for now:** `drawWinterBackdrop` and the low-res `Snowfall` in `draw.js` stay, because the placeholder event (low-res) still uses them; they go when that event is replaced.

## Look

- **New palette keys:** `slate` `#2a2d36` (panel fill), `slateEdge` `#6a6d75` (panel border), `paper` `#ece9e2` (body text), `paperDim` `#a9a7a2` (secondary text and prompts). The accent colour is the existing `red` (`#d02020`, the skier's helmet). Existing keys stay unchanged.
- **Panel (`drawPanel(ctx, x, y, width, height)`, canvas pixels):** 2 px `slateEdge` border; the inside is one `slate` fill at 88 % opacity (`rgba`), so the backdrop shows through slightly. (A per-pixel dither would cost tens of thousands of `fillRect` calls per frame.) The placeholder event still draws at 320×256, so its panel border shows 4 px wide; acceptable until that event is replaced.
- **Menu (`Menu#render(ctx, centerX, y, { lineHeight, maxVisible, scale = 1 })`):** the selected row in `red` with arrows (`> KILPAILU <`), other rows in `paper`.
- **Title:** "WINTER" and "GAMES" at scale 8 in `paper` with a `slate` shadow; "TALVIKISAT" at scale 2 in `red`; the menu panel below; the controls hint on the snow in `slate` (`paperDim` is too faint on snow).
- **Info, practice select, final:** titles in `red` (scale 4), body lines in `paper`, the blinking prompt in `paperDim`. Final results: event rows and the total in `paper`, the divider line in `slateEdge`, the total row in `red`.
- **Nickname:** the entry field is a small panel in the same style; the cursor and error messages in `red`; hints in `paperDim`.
- **Pause:** the existing dark dim over the whole canvas (`rgba(0, 0, 0, 0.6)`) and the same panel in the middle; title in `red`.

## Testing

- Moving the helpers to `scenery.js` keeps every existing ski jump render test passing unchanged (proof the ski jump looks the same).
- `scenery.test.js`: `drawVenueBackdrop` starts with full-width sky bands, draws only whole-pixel rects, shows the distant ski jump, is deterministic for a given `time` and drifts as `time` grows.
- `draw.test.js`: `drawPanel` draws the translucent fill inside a 2 px border.
- Menu scene tests: each of the six scenes has `highResolution === true` and renders only whole-pixel rects with a recording context, and no longer uses the old retro colours (`yellow`, `skyLight`, `night`); existing behaviour tests keep passing.
- Browser check (`npm run dev`): title, practice select, info screens, nickname, final results, and the pause menu over both slalom and the ski jump; frame rate stays at 60 fps.
