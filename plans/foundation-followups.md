# Foundation follow-ups for the event plans

Deferred findings from the foundation reviews. Each event plan picks up the items it needs.

## Slalom plan
- Done in `plans/2026-10-06-slalom.md`: per-tick press counting (`Input#pressCount`), `event.key` guard, `fakeInput` held/pressed/counts, slalom time tie-break test.

## Ski jump plan
- Round both x and y in `drawText` (camera scrolling gives fractional positions).
- `skiJumpPoints` returns NaN for an unknown landing: add a guard and tests, plus `LANDING_POINTS` tests.

## Luge plan
- Add a luge "faster but fewer points" test for `bestAttempt`.
- Consider `pause()`/`resume()` hooks on event scenes for continuous sounds (scraping) while the pause menu is open.

## Ski jump and luge plans (both)
- Add the event's bot driver to `tests/helpers/eventDrivers.js` (`inputForEvent`) and extend `finishAttempt` in `tests/flow.test.js`, which currently detects only `SlalomScene`.

## After the ski jump: playable on GitHub Pages (user decision 2026-10-07)
- Publish the game itself on GitHub Pages (e.g. `docs/peli/`, or a GitHub Actions deploy) so it runs in a browser without installing Node.
- Add a `localStorage` score repository used when the local Node server is not available: results stay in the player's own browser, no shared leaderboard, no API keys.
- Competitions for the shared leaderboard are still played locally through the Node server (`npm start`).

## Any time
- Flow tests: save failure and retry, nickname load failure, resume from pause.
- Add a fixed-stepper test where clamping leaves a remainder (`createFixedStepper`).
- Pages: `formatMetric` throws on string values; `formatDate` uses local time. Google Fonts is an external request; decide before public launch.
- Server: Windows `rename` EPERM/EBUSY retry; 400/413 for malformed URL escapes and oversized bodies.
- Practice quit keeps the event theme playing; Escape while typing a nickname returns to the title instead of the list.

## Dev workflow
- Use `npm run dev` for browser checks in a worktree: results go to `docs/leaderboard.dev.json` (gitignored) and nothing is committed or pushed.
