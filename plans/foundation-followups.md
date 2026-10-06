# Foundation follow-ups for the event plans

Deferred findings from the foundation reviews. Each event plan picks up the items it needs.

## Slalom plan (first space-mashing event, before luge)
- `Input.pressed` is a Set: repeated presses of the same key within one fixed tick collapse into one. Change to a count map and add `pressCount(code)`; keep `wasPressed`. Slalom and luge count presses.
- Guard `event.key` in `Input.onKeyDown`; add a stepper test for clamp-with-remainder.
- Add a slalom time tie-break test to `tests/core/scoring.test.js`.

## Ski jump plan
- Round both x and y in `drawText` (camera scrolling gives fractional positions).
- `skiJumpPoints` returns NaN for an unknown landing: add a guard and tests, plus `LANDING_POINTS` tests.
- Extend `tests/helpers/fakeInput.js` so "held" (`isDown`) and "newly pressed" (`wasPressed`) can differ, and support press counts.

## Luge plan
- Add a luge "faster but fewer points" test for `bestAttempt`.
- Consider `pause()`/`resume()` hooks on event scenes for continuous sounds (scraping) while the pause menu is open.

## Any time
- Flow tests: save failure and retry, nickname load failure, resume from pause.
- Pages: `formatMetric` throws on string values; `formatDate` uses local time. Google Fonts is an external request; decide before public launch.
- Server: Windows `rename` EPERM/EBUSY retry; 400/413 for malformed URL escapes and oversized bodies.
- Practice quit keeps the event theme playing; Escape while typing a nickname returns to the title instead of the list.

## Dev workflow
- Use `npm run dev` for browser checks in a worktree: results go to `docs/leaderboard.dev.json` (gitignored) and nothing is committed or pushed.
