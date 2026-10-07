# Play on GitHub Pages (localStorage scores) – Design

Makes the game playable in a browser without Node, on the existing GitHub Pages site. Picks up the "After the ski jump: playable on GitHub Pages" item in `plans/foundation-followups.md`. Competitions for the shared leaderboard are still played locally through the Node server (`npm start`); on Pages the results stay in the player's own browser.

## Scope

- In scope: a Pages site that serves the leaderboard (as today) and the game, a GitHub Actions deploy, and a `localStorage` score repository that the game uses when the Node server is not available.
- Not in scope: a shared online leaderboard, accounts, API keys, changes to game rules, scenes or the Node server's behaviour.

## Publishing

- **Site layout.** `docs/` is published as the site root (the leaderboard stays at `https://jounijokelainen.github.io/winter-games/`), and `game/` is published under `peli/` (the game opens at `.../winter-games/peli/`). The leaderboard page gets a "PELAA" link to `peli/`.
- **Build script `scripts/build-site.mjs`** (Node built-ins only, run with `npm run build:site`). It writes `_site/`: a copy of `docs/` plus `game/` in `_site/peli/`. It skips `*.dev.json` files so development results never become public. `_site/` is added to `.gitignore`.
- **Workflow `.github/workflows/pages.yml`.** Runs on pushes to `main` that change `docs/`, `game/`, `scripts/` or the workflow itself, and on `workflow_dispatch`. The build job checks out the repository, runs `npm run build:site` and uploads `_site/` with `actions/upload-pages-artifact`; the deploy job uses `actions/deploy-pages`. Permissions: `contents: read`, `pages: write`, `id-token: write`. The official `actions/checkout`, `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages` run on GitHub's servers; nothing is installed locally. Every leaderboard push from the Node server redeploys the site, as the legacy Pages build did.
- **Rollout (outward-facing; each step needs the user's explicit go-ahead).** (1) Push the branch to `main` — pushing a workflow file needs the `workflow` scope on the `gh` token (`! gh auth refresh -s workflow` if missing). (2) Switch Pages from the legacy `main:/docs` build to the Actions build (`gh api` on `repos/JouniJokelainen/winter-games/pages`). (3) Trigger the workflow right after the switch (the site may be briefly unavailable in between), open the published URL and play one competition.

## Score storage

- **Shared leaderboard logic moves to the game.** `server/leaderboard.js` (`validateResult`, `applyResult`, `emptyBoard`, `topTotals`, …) is pure and imports only `game/core/rules.js`. It moves to `game/core/leaderboard.js` (`git mv`) so the browser can import it from the published `peli/` folder. `server/app.js`, `server/leaderboardStore.js` and the tests that import it are updated; the logic itself does not change, so the browser and the server compute results identically.
- **`LocalScoreRepository` (`game/core/localScoreRepository.js`).** Same interface as `HttpScoreRepository`: `getLeaderboard()`, `getNicknames()`, `getUser(nickname)`, `saveResult(payload)`. The board is stored as JSON in `localStorage` under `winterGames.board`; `saveResult` validates with `validateResult`, applies the result with `applyResult` and returns `{ saved: true, local: true, committed: false, pushed: false, user }`. A missing storage object (blocked `localStorage`) or unparseable JSON starts an empty board kept in memory for the session; invalid payloads reject with the validation message, like the server's 400.
- **Choosing the repository.** `chooseScoreRepository({ fetchFn, storage, timeoutMs = 2000 })` in `game/core/scoreRepository.js` tries `GET /api/leaderboard` once. A successful response selects `HttpScoreRepository`; a failure (404 on Pages, network error, timeout) selects `LocalScoreRepository`. `game/main.js` awaits the choice before `flow.toTitle()`, so the repository does not change during a session.
- **UI.** `FinalScene` maps `response.local` to a new status `local` with the text `TULOS TALLENNETTU SELAIMEEN`; the other statuses (`saving`, `published`, `saved`, `failed`), the flow, the nickname list and the retry on failure are unchanged.

## Testing

- `tests/core/localScoreRepository.test.js`: save and read back; the better result wins as on the server; the board persists across new repository instances over the same fake storage; an invalid payload is rejected; corrupt JSON and a missing storage object give an empty working board.
- `tests/core/scoreRepository.test.js`: `chooseScoreRepository` returns the HTTP repository when the server answers, and the local one on a 404, on a rejected fetch and on a timeout.
- `tests/scenes`: `FinalScene` shows `TULOS TALLENNETTU SELAIMEEN` when `saveResult` returns `local: true`.
- `tests/scripts/buildSite.test.js`: building into a temp directory produces `index.html`, `leaderboard.json`, `peli/index.html` and `peli/main.js`, and no `*.dev.json` file.
- Existing server and leaderboard tests keep passing after the move (imports updated only).
- Browser check: serve `_site/` with a tiny static server that has no `/api`, open `/peli/`, play a whole competition, and confirm the board in `localStorage` and the nickname list on the next visit. After rollout, the same check on the real Pages URL.
