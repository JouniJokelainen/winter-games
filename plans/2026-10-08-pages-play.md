# Play on GitHub Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game playable in a browser without Node: a GitHub Actions deploy publishes the leaderboard (`docs/`) and the game (`game/` under `peli/`), and the game stores results in the browser's `localStorage` when the Node server is not available.

**Architecture:** The pure leaderboard logic moves from `server/` to `game/core/` so the browser can run it. A `LocalScoreRepository` (same interface as `HttpScoreRepository`) keeps the board in `localStorage`; `chooseScoreRepository` probes `/api/leaderboard` once at start-up and falls back to the local repository. A Node build script assembles `_site/` and a Pages workflow deploys it.

**Tech Stack:** Plain JS ES modules, Node built-ins, `node:test`, GitHub Actions (official Pages actions).

**Design:** `plans/2026-10-08-pages-play-design.md`.

## Global Constraints

- No npm dependencies; Node built-ins only. Never run `npm install`.
- All code, identifiers, comments and commit messages in English. All player-visible text in Finnish, UPPERCASE.
- Never store API keys or tokens in code or files.
- Game rules, scenes, flow and the Node server's behaviour do not change; only where the leaderboard logic lives, how scores are stored in the browser, and how the site is built and published.
- Results computed in the browser and on the server must use the same code (`game/core/leaderboard.js`).
- Tests: `npm test` (= `node --test tests/`), files `tests/**/*.test.js`.
- Browser checks use `npm run dev` or a local static server (no results are committed or pushed).
- Pushing, switching the Pages setting and triggering the workflow are outward-facing: they are done only by the controller with the user's explicit go-ahead (see "Rollout").
- Commit messages end with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File Structure

```
game/core/leaderboard.js                 MOVED from server/leaderboard.js (pure logic, unchanged apart from the rules import)
game/core/localScoreRepository.js        CREATE: LocalScoreRepository over localStorage
game/core/scoreRepository.js             MODIFY: add chooseScoreRepository
game/scenes/finalScene.js                MODIFY: 'local' save status
game/main.js                             MODIFY: await chooseScoreRepository
server/app.js, server/leaderboardStore.js MODIFY: import from ../game/core/leaderboard.js
scripts/build-site.mjs                   CREATE: builds _site/
.github/workflows/pages.yml              CREATE: Pages deploy
docs/index.html, docs/style.css          MODIFY: "PELAA" link
package.json                             MODIFY: build:site script
.gitignore                               MODIFY: _site/
plans/foundation-followups.md            MODIFY: mark the Pages item as planned/done
tests/core/leaderboard.test.js           MOVED from tests/server/leaderboard.test.js
tests/core/localScoreRepository.test.js  CREATE
tests/core/scoreRepository.test.js       MODIFY: chooseScoreRepository tests
tests/scenes/finalScene.test.js          CREATE
tests/scripts/buildSite.test.js          CREATE
tests/scripts/pagesWorkflow.test.js      CREATE
```

---

### Task 1: Move the leaderboard logic to `game/core`

**Files:**
- Move: `server/leaderboard.js` → `game/core/leaderboard.js`; `tests/server/leaderboard.test.js` → `tests/core/leaderboard.test.js`
- Modify: `server/app.js`, `server/leaderboardStore.js`, `tests/server/leaderboardStore.test.js`, `tests/events/contract.test.js`, `tests/events/skiJump/skiJumpScene.test.js`

**Interfaces:**
- Produces: `game/core/leaderboard.js` exporting exactly what `server/leaderboard.js` exports today (`RECENT_LIMIT`, `TOP_LIMIT`, `emptyBoard`, `validateResult`, `isBetterRecord`, `topTotals`, `eventRecords`, `applyResult`). The logic does not change.

This is a pure move: the test count must stay the same and every existing test must still pass.

- [ ] **Step 1: Record the baseline**

Run: `npm test`
Write the `# pass` number into your report as BEFORE (expected: all pass, no failures).

- [ ] **Step 2: Move the files**

```bash
git mv server/leaderboard.js game/core/leaderboard.js
git mv tests/server/leaderboard.test.js tests/core/leaderboard.test.js
```

- [ ] **Step 3: Fix the imports**

In `game/core/leaderboard.js`, change the first import's path:

```js
import {
  EVENT_IDS, isValidNickname, MAX_POINTS, METRIC_KEY, normalizeNickname, SKI_JUMP_MAX_DISTANCE,
} from './rules.js';
```

(only `'../game/core/rules.js'` → `'./rules.js'`; the rest of the file is unchanged).

In `server/app.js` replace `import { applyResult, validateResult } from './leaderboard.js';` with:

```js
import { applyResult, validateResult } from '../game/core/leaderboard.js';
```

In `server/leaderboardStore.js` replace `import { emptyBoard } from './leaderboard.js';` with:

```js
import { emptyBoard } from '../game/core/leaderboard.js';
```

In `tests/core/leaderboard.test.js` replace `'../../server/leaderboard.js'` with `'../../game/core/leaderboard.js'`.

In `tests/server/leaderboardStore.test.js` replace `'../../server/leaderboard.js'` with `'../../game/core/leaderboard.js'`.

In `tests/events/contract.test.js` replace `'../../server/leaderboard.js'` with `'../../game/core/leaderboard.js'`.

In `tests/events/skiJump/skiJumpScene.test.js` replace `'../../../server/leaderboard.js'` with `'../../../game/core/leaderboard.js'`.

- [ ] **Step 4: Check nothing still points at the old path**

Run: `grep -rn "server/leaderboard.js\|from './leaderboard.js'" game server tests docs --include=*.js`
Expected: no output (plans/ documents may still mention the old path; leave them).

- [ ] **Step 5: Run the full suite and compare**

Run: `npm test`
Expected: the same `# pass` number as BEFORE, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add -A game/core/leaderboard.js tests/core/leaderboard.test.js server tests
git commit -m "refactor: move the leaderboard logic to game/core

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Local score repository

**Files:**
- Create: `game/core/localScoreRepository.js`, `tests/core/localScoreRepository.test.js`

**Interfaces:**
- Consumes: `applyResult(board, result, date)`, `emptyBoard()`, `validateResult(payload)` from `game/core/leaderboard.js` (Task 1).
- Produces: `LOCAL_BOARD_KEY = 'winterGames.board'` and `class LocalScoreRepository`:
  - `constructor(storage = null, now = () => new Date())` — `storage` has `getItem(key)` / `setItem(key, value)` (a `localStorage`), or `null`
  - `async getLeaderboard()` → board object
  - `async getNicknames()` → nicknames sorted with `localeCompare(…, 'fi')`
  - `async getUser(nickname)` → user or `null`
  - `async saveResult(payload)` → `{ saved: true, local: true, committed: false, pushed: false, user }`; rejects with `Error(validation message)` for an invalid payload and stores nothing

- [ ] **Step 1: Write the failing test**

`tests/core/localScoreRepository.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_BOARD_KEY, LocalScoreRepository } from '../../game/core/localScoreRepository.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

function payload(nickname, skiJump, slalom, luge) {
  return {
    nickname,
    events: {
      skiJump: { points: skiJump, distance: 150 },
      slalom: { points: slalom, time: 34.5 },
      luge: { points: luge, time: 36.2 },
    },
  };
}

const NOW = () => new Date('2026-10-08T10:00:00.000Z');

test('a saved result can be read back and is marked local', async () => {
  const repository = new LocalScoreRepository(fakeStorage(), NOW);
  const response = await repository.saveResult(payload('aku', 40, 30, 20));
  assert.deepEqual(
    { saved: response.saved, local: response.local, committed: response.committed, pushed: response.pushed },
    { saved: true, local: true, committed: false, pushed: false },
  );
  assert.equal(response.user.bestTotal, 90);
  assert.deepEqual(await repository.getNicknames(), ['AKU']);
  assert.equal((await repository.getUser('AKU')).bestTotal, 90);
  assert.equal(await repository.getUser('NOBODY'), null);
  assert.equal((await repository.getLeaderboard()).recent[0].total, 90);
});

test('the best total is kept and every competition is counted', async () => {
  const repository = new LocalScoreRepository(fakeStorage(), NOW);
  await repository.saveResult(payload('AKU', 20, 20, 20));
  await repository.saveResult(payload('AKU', 50, 40, 30));
  await repository.saveResult(payload('AKU', 10, 10, 10));
  const user = await repository.getUser('AKU');
  assert.equal(user.bestTotal, 120);
  assert.equal(user.competitions, 3);
});

test('nicknames are sorted in Finnish alphabetical order', async () => {
  const repository = new LocalScoreRepository(fakeStorage(), NOW);
  for (const name of ['ÖRKKI', 'AKU', 'ÄIJÄ']) await repository.saveResult(payload(name, 10, 10, 10));
  assert.deepEqual(await repository.getNicknames(), ['AKU', 'ÄIJÄ', 'ÖRKKI']);
});

test('results persist across repository instances that share the storage', async () => {
  const storage = fakeStorage();
  await new LocalScoreRepository(storage, NOW).saveResult(payload('AKU', 40, 30, 20));
  assert.ok(storage.data.has(LOCAL_BOARD_KEY));
  assert.deepEqual(await new LocalScoreRepository(storage, NOW).getNicknames(), ['AKU']);
});

test('an invalid payload is rejected with the validation message and stores nothing', async () => {
  const storage = fakeStorage();
  const repository = new LocalScoreRepository(storage, NOW);
  await assert.rejects(repository.saveResult({ nickname: '', events: {} }), /invalid nickname/);
  assert.equal(storage.data.size, 0);
});

test('unparseable stored data starts an empty board that can be saved to', async () => {
  const storage = fakeStorage({ [LOCAL_BOARD_KEY]: '{oops' });
  const repository = new LocalScoreRepository(storage, NOW);
  assert.deepEqual(await repository.getNicknames(), []);
  await repository.saveResult(payload('AKU', 40, 30, 20));
  assert.deepEqual(JSON.parse(storage.data.get(LOCAL_BOARD_KEY)).users.AKU.bestTotal, 90);
});

test('stored data of the wrong shape is treated as an empty board', async () => {
  const storage = fakeStorage({ [LOCAL_BOARD_KEY]: JSON.stringify({ hello: 'world' }) });
  assert.deepEqual(await new LocalScoreRepository(storage, NOW).getNicknames(), []);
});

test('without storage the board is kept in memory for the session', async () => {
  const repository = new LocalScoreRepository(null, NOW);
  await repository.saveResult(payload('AKU', 40, 30, 20));
  assert.deepEqual(await repository.getNicknames(), ['AKU']);
});

test('a storage that refuses writes falls back to memory', async () => {
  const storage = fakeStorage();
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const repository = new LocalScoreRepository(storage, NOW);
  await repository.saveResult(payload('AKU', 40, 30, 20));
  assert.deepEqual(await repository.getNicknames(), ['AKU']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/core/localScoreRepository.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `localScoreRepository.js`.

- [ ] **Step 3: Write `game/core/localScoreRepository.js`**

```js
import { applyResult, emptyBoard, validateResult } from './leaderboard.js';

export const LOCAL_BOARD_KEY = 'winterGames.board';

function isBoard(value) {
  return Boolean(value) && value.version === 1 && typeof value.users === 'object' && value.users !== null
    && Array.isArray(value.recent);
}

// Keeps the leaderboard in the player's own browser (localStorage) when no Node server is available.
// Same interface as HttpScoreRepository. Without usable storage the board lives in memory for the session.
export class LocalScoreRepository {
  constructor(storage = null, now = () => new Date()) {
    this.storage = storage;
    this.now = now;
    this.memoryBoard = null;
  }

  readBoard() {
    if (this.memoryBoard) return this.memoryBoard;
    if (!this.storage) return emptyBoard();
    try {
      const raw = this.storage.getItem(LOCAL_BOARD_KEY);
      if (raw === null) return emptyBoard();
      const board = JSON.parse(raw);
      return isBoard(board) ? board : emptyBoard();
    } catch {
      return emptyBoard();
    }
  }

  writeBoard(board) {
    if (this.storage) {
      try {
        this.storage.setItem(LOCAL_BOARD_KEY, JSON.stringify(board));
        this.memoryBoard = null;
        return;
      } catch {
        // Storage is blocked or full: keep the board in memory instead.
      }
    }
    this.memoryBoard = board;
  }

  async getLeaderboard() {
    return this.readBoard();
  }

  async getNicknames() {
    return Object.keys(this.readBoard().users).sort((a, b) => a.localeCompare(b, 'fi'));
  }

  async getUser(nickname) {
    return this.readBoard().users[nickname] ?? null;
  }

  async saveResult(payload) {
    const validation = validateResult(payload);
    if (!validation.ok) throw new Error(validation.error);
    const result = validation.value;
    const board = applyResult(this.readBoard(), result, this.now().toISOString());
    this.writeBoard(board);
    return { saved: true, local: true, committed: false, pushed: false, user: board.users[result.nickname] };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/core/localScoreRepository.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/core/localScoreRepository.js tests/core/localScoreRepository.test.js
git commit -m "feat: add a localStorage score repository

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Choose the repository at start-up and show the local status

**Files:**
- Modify: `game/core/scoreRepository.js`, `game/scenes/finalScene.js`, `game/main.js`, `tests/core/scoreRepository.test.js`
- Create: `tests/scenes/finalScene.test.js`

**Interfaces:**
- Consumes: `LocalScoreRepository` (Task 2); `HttpScoreRepository` (existing, same file).
- Produces: `async chooseScoreRepository({ fetchFn = globalThis.fetch, storage = null, timeoutMs = 2000 } = {})` in `game/core/scoreRepository.js` → `HttpScoreRepository` when `GET /api/leaderboard` succeeds within `timeoutMs` and returns JSON, otherwise `new LocalScoreRepository(storage)`. `FinalScene` shows status `local` (`TULOS TALLENNETTU SELAIMEEN`) when `saveResult` returns `local: true`.

- [ ] **Step 1: Write the failing tests**

In `tests/core/scoreRepository.test.js` change the import line to:

```js
import { chooseScoreRepository, HttpScoreRepository } from '../../game/core/scoreRepository.js';
import { LocalScoreRepository } from '../../game/core/localScoreRepository.js';
```

and append:

```js
test('chooseScoreRepository picks the HTTP repository when the server answers', async () => {
  const { fetchFn, calls } = fakeFetch({ '/api/leaderboard': { body: BOARD } });
  const repository = await chooseScoreRepository({ fetchFn });
  assert.ok(repository instanceof HttpScoreRepository);
  assert.equal(calls.length, 1);
});

test('chooseScoreRepository falls back to the local repository on a 404 (GitHub Pages)', async () => {
  const { fetchFn } = fakeFetch({ '/api/leaderboard': { status: 404, body: {} } });
  const storage = { getItem: () => null, setItem() {} };
  const repository = await chooseScoreRepository({ fetchFn, storage });
  assert.ok(repository instanceof LocalScoreRepository);
  assert.equal(repository.storage, storage);
});

test('chooseScoreRepository falls back to the local repository on a network error', async () => {
  const fetchFn = async () => { throw new TypeError('Failed to fetch'); };
  assert.ok((await chooseScoreRepository({ fetchFn })) instanceof LocalScoreRepository);
});

test('chooseScoreRepository falls back when the response is not JSON', async () => {
  const fetchFn = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } });
  assert.ok((await chooseScoreRepository({ fetchFn })) instanceof LocalScoreRepository);
});

test('chooseScoreRepository falls back when the server does not answer in time', async () => {
  const fetchFn = () => new Promise(() => {});
  assert.ok((await chooseScoreRepository({ fetchFn, timeoutMs: 20 })) instanceof LocalScoreRepository);
});
```

`tests/scenes/finalScene.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawText } from '../../game/engine/font.js';
import { PALETTE } from '../../game/engine/palette.js';
import { FinalScene } from '../../game/scenes/finalScene.js';
import { recordingCtx } from '../helpers/recordingCtx.js';

const competition = {
  nickname: 'AKU',
  eventIds: ['skiJump', 'slalom', 'luge'],
  eventResult: () => ({ points: 30 }),
  total: 90,
  toPayload: () => ({}),
};

async function finishedScene(response) {
  const game = { audio: { playSfx() {} }, repository: { saveResult: async () => response } };
  const scene = new FinalScene({ game, competition, onDone() {} });
  scene.enter();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return scene;
}

function drawsStatusText(scene, text) {
  const expected = recordingCtx();
  drawText(expected, text, 320, 332, { align: 'center', scale: 2, color: PALETTE.paper });
  const actual = recordingCtx();
  scene.render(actual);
  const drawn = new Set(actual.rects.map((rect) => JSON.stringify(rect)));
  return expected.rects.every((rect) => drawn.has(JSON.stringify(rect)));
}

test('a local save says the result was stored in the browser', async () => {
  const scene = await finishedScene({ saved: true, local: true, pushed: false });
  assert.equal(scene.status, 'local');
  assert.ok(drawsStatusText(scene, 'TULOS TALLENNETTU SELAIMEEN'));
});

test('server saves keep their published and saved statuses', async () => {
  const published = await finishedScene({ saved: true, pushed: true });
  assert.equal(published.status, 'published');
  assert.ok(drawsStatusText(published, 'TULOS TALLENNETTU JA JULKAISTU'));
  const saved = await finishedScene({ saved: true, pushed: false });
  assert.equal(saved.status, 'saved');
  assert.ok(drawsStatusText(saved, 'TULOS TALLENNETTU (EI JULKAISTU)'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/core/scoreRepository.test.js tests/scenes/finalScene.test.js`
Expected: FAIL — `chooseScoreRepository` is not exported; the final scene status is `saved`, not `local`.

- [ ] **Step 3: Add `chooseScoreRepository`**

In `game/core/scoreRepository.js` add the import at the top:

```js
import { LocalScoreRepository } from './localScoreRepository.js';
```

and append at the end of the file:

```js
// Probes the Node server once. Without it (GitHub Pages, server not running) results are kept in the
// player's own browser. The choice is made once at start-up, so it never changes during a session.
export async function chooseScoreRepository({
  fetchFn = (...args) => globalThis.fetch(...args),
  storage = null,
  timeoutMs = 2000,
} = {}) {
  const http = new HttpScoreRepository(fetchFn);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  try {
    await Promise.race([http.getLeaderboard(), timeout]);
    return http;
  } catch {
    return new LocalScoreRepository(storage);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Add the `local` status to the final scene**

In `game/scenes/finalScene.js` replace the `STATUS_TEXT` object and the `.then(...)` line in `save()`:

```js
const STATUS_TEXT = {
  saving: 'TALLENNETAAN...',
  local: 'TULOS TALLENNETTU SELAIMEEN',
  published: 'TULOS TALLENNETTU JA JULKAISTU',
  saved: 'TULOS TALLENNETTU (EI JULKAISTU)',
  failed: 'TALLENNUS EPÄONNISTUI',
};

function statusFor(response) {
  if (response.local) return 'local';
  return response.pushed ? 'published' : 'saved';
}
```

and in `save()`:

```js
      .then((response) => { this.status = statusFor(response); })
```

- [ ] **Step 5: Use it in `game/main.js`**

Replace the imports and the `audio`/`game` set-up so the file starts:

```js
import { AudioEngine } from './audio/audioEngine.js';
import { chooseScoreRepository } from './core/scoreRepository.js';
import { FIXED_STEP } from './engine/constants.js';
import { Input } from './engine/input.js';
import { startLoop } from './engine/loop.js';
import { SceneManager } from './engine/sceneManager.js';
import { createScreen } from './engine/screen.js';
import { createFlow } from './flow.js';

function safeLocalStorage() {
  try {
    const storage = window.localStorage;
    storage.getItem('winterGames.probe');
    return storage;
  } catch {
    return null;
  }
}

const storage = safeLocalStorage();
const ctx = createScreen(document.getElementById('screen'));
const input = new Input(window);
const audio = new AudioEngine(storage);
window.addEventListener('keydown', () => audio.unlock());

const repository = await chooseScoreRepository({ storage });
const game = { scenes: new SceneManager(), input, audio, repository };
const flow = createFlow(game);
flow.toTitle();
```

The rest of the file (`startLoop(...)`) stays as it is.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/core/ tests/scenes/ tests/flow.test.js`
Expected: PASS.

- [ ] **Step 7: Run the full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add game/core/scoreRepository.js game/scenes/finalScene.js game/main.js tests/core/scoreRepository.test.js tests/scenes/finalScene.test.js
git commit -m "feat: fall back to browser storage when the score server is unavailable

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Browser check with the Node server (controller)**

Run `npm run dev`, open `http://127.0.0.1:8080/`, practice or play: with the server the final screen must still say `TULOS TALLENNETTU (EI JULKAISTU)` (dev mode does not publish) and the game must start without a delay.

---

### Task 4: Site build script and the "PELAA" link

**Files:**
- Create: `scripts/build-site.mjs`, `tests/scripts/buildSite.test.js`
- Modify: `package.json`, `.gitignore`, `docs/index.html`, `docs/style.css`

**Interfaces:**
- Produces: `buildSite({ repoDir = <repo root>, outDir = <repoDir>/_site } = {})` exported from `scripts/build-site.mjs` → resolves to the `outDir` path. It deletes `outDir`, copies `docs/` into it and `game/` into `outDir/peli`, skipping every `*.dev.json` file. Running the file directly (`npm run build:site`) builds `_site/`.

- [ ] **Step 1: Write the failing test**

`tests/scripts/buildSite.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../../scripts/build-site.mjs';

const realRepo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function tempDir(t, prefix) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function write(root, relativePath, text) {
  const file = join(root, relativePath);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
}

test('docs go to the site root and the game to peli/, without development results', async (t) => {
  const root = await tempDir(t, 'wg-site-src-');
  await write(root, 'docs/index.html', 'leaderboard');
  await write(root, 'docs/leaderboard.json', '{}');
  await write(root, 'docs/leaderboard.dev.json', 'secret test results');
  await write(root, 'game/index.html', 'game');
  await write(root, 'game/core/rules.js', 'export {};');
  await write(root, 'game/core/rules.dev.json', 'also skipped');
  const outDir = await tempDir(t, 'wg-site-out-');
  await write(outDir, 'stale.txt', 'left over from an earlier build');

  assert.equal(await buildSite({ repoDir: root, outDir }), outDir);

  assert.equal(await readFile(join(outDir, 'index.html'), 'utf8'), 'leaderboard');
  assert.equal(await readFile(join(outDir, 'leaderboard.json'), 'utf8'), '{}');
  assert.equal(await readFile(join(outDir, 'peli', 'index.html'), 'utf8'), 'game');
  assert.equal(await readFile(join(outDir, 'peli', 'core', 'rules.js'), 'utf8'), 'export {};');
  const files = await readdir(outDir, { recursive: true });
  assert.ok(!files.some((file) => file.endsWith('.dev.json')), files.join(', '));
  assert.ok(!files.includes('stale.txt'));
});

test('the real repository builds a playable site that links to the game', async (t) => {
  const outDir = await tempDir(t, 'wg-site-real-');
  await buildSite({ repoDir: realRepo, outDir });
  for (const file of ['index.html', 'leaderboard.json', 'peli/index.html', 'peli/main.js', 'peli/core/leaderboard.js']) {
    assert.ok((await readFile(join(outDir, file), 'utf8')).length > 0, file);
  }
  assert.match(await readFile(join(outDir, 'index.html'), 'utf8'), /href="peli\/"/);
  const files = await readdir(outDir, { recursive: true });
  assert.ok(!files.some((file) => file.endsWith('.dev.json')));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/scripts/buildSite.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/build-site.mjs`.

- [ ] **Step 3: Write `scripts/build-site.mjs`**

```js
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRepoDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const skipDevelopmentResults = (source) => !source.endsWith('.dev.json');

// Builds the GitHub Pages site: docs/ (the leaderboard) at the root and game/ under peli/.
// Development results (*.dev.json) are never copied.
export async function buildSite({ repoDir = defaultRepoDir, outDir = join(repoDir, '_site') } = {}) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(join(repoDir, 'docs'), outDir, { recursive: true, filter: skipDevelopmentResults });
  await cp(join(repoDir, 'game'), join(outDir, 'peli'), { recursive: true, filter: skipDevelopmentResults });
  return outDir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Site built in ${await buildSite()}`);
}
```

- [ ] **Step 4: Add the "PELAA" link, the npm script and the ignore rule**

In `docs/index.html`, inside `<header>` after the subtitle paragraph, add:

```html
    <p class="play"><a href="peli/">PELAA</a></p>
```

so the header reads:

```html
  <header>
    <h1>WINTER GAMES</h1>
    <p class="subtitle">TALVIKISAT – TULOSTAULU</p>
    <p class="play"><a href="peli/">PELAA</a></p>
  </header>
```

Append to `docs/style.css`:

```css
.play { text-align: center; margin: 12px 0 0; }
.play a { color: var(--yellow); text-decoration: none; border: 2px solid var(--yellow); padding: 6px 14px; }
.play a:hover, .play a:focus { background: var(--yellow); color: var(--night); }
```

In `package.json` add the script (keep the others):

```json
    "build:site": "node scripts/build-site.mjs",
```

so `scripts` becomes `start`, `dev`, `build:site`, `test` (in that order). Add `_site/` on its own line to `.gitignore`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/scripts/buildSite.test.js`
Expected: PASS (2 tests).

Then run `npm run build:site` once: expected output `Site built in …/_site`, and `_site/peli/index.html` exists. `git status` must not list `_site/` (ignored).

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add scripts/build-site.mjs tests/scripts/buildSite.test.js package.json .gitignore docs/index.html docs/style.css
git commit -m "feat: build the Pages site with the game under peli/

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Browser check of the static site (controller)**

Write a tiny static server without any `/api` route to the scratchpad directory (not into the repo), for example `static.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2]);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(join(root, normalize(path)));
    if (!file.startsWith(root + sep)) throw new Error('outside root');
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(8082, '127.0.0.1');
```

Run `node <scratchpad>/static.mjs _site`, open `http://127.0.0.1:8082/` (the leaderboard with the PELAA link) and `http://127.0.0.1:8082/peli/` (the game). Play a whole competition: the final screen must say `TULOS TALLENNETTU SELAIMEEN`; reload and start another competition: the nickname list must offer the player; `localStorage['winterGames.board']` must hold the board.

---

### Task 5: Pages workflow

**Files:**
- Create: `.github/workflows/pages.yml`, `tests/scripts/pagesWorkflow.test.js`
- Modify: `plans/foundation-followups.md`

**Interfaces:**
- Consumes: `npm run build:site` (Task 4).
- Produces: a workflow that deploys `_site/` to GitHub Pages on pushes to `main` that touch the site, and on demand.

- [ ] **Step 1: Write the failing test**

`tests/scripts/pagesWorkflow.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflow = await readFile(join(repoDir, '.github', 'workflows', 'pages.yml'), 'utf8');

test('the workflow builds the site and deploys it with the official Pages actions', () => {
  for (const expected of [
    'actions/checkout@',
    'actions/configure-pages@',
    'run: npm run build:site',
    'actions/upload-pages-artifact@',
    'path: _site',
    'actions/deploy-pages@',
    'pages: write',
    'id-token: write',
    'workflow_dispatch',
  ]) {
    assert.ok(workflow.includes(expected), `missing ${expected}`);
  }
});

test('the workflow runs on pushes to main that change the site', () => {
  assert.match(workflow, /branches: \[main\]/);
  for (const path of ["'docs/**'", "'game/**'", "'scripts/**'", "'.github/workflows/pages.yml'"]) {
    assert.ok(workflow.includes(path), `missing path filter ${path}`);
  }
});

test('the build:site script runs the build script', async () => {
  const pkg = JSON.parse(await readFile(join(repoDir, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['build:site'], 'node scripts/build-site.mjs');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/scripts/pagesWorkflow.test.js`
Expected: FAIL — `ENOENT` for `.github/workflows/pages.yml`.

- [ ] **Step 3: Write `.github/workflows/pages.yml`**

```yaml
name: Pages

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - 'game/**'
      - 'scripts/**'
      - '.github/workflows/pages.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - run: npm run build:site
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Update the follow-ups note**

In `plans/foundation-followups.md`, replace the whole section `## After the ski jump: playable on GitHub Pages (user decision 2026-10-07)` (heading and its three bullets) with:

```markdown
## Playable on GitHub Pages (user decision 2026-10-07)
- Planned and built in `plans/2026-10-08-pages-play.md`: the game is published under `peli/` by a GitHub Actions deploy, and results are stored in the player's own browser (`localStorage`) when the Node server is not available. No shared leaderboard, no API keys.
- Competitions for the shared leaderboard are still played locally through the Node server (`npm start`).
- Rollout (switching Pages from the legacy `docs/` build to Actions, first deploy) is done separately with the user's go-ahead.
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/scripts/pagesWorkflow.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test` — expected: all pass.

```bash
git add .github/workflows/pages.yml tests/scripts/pagesWorkflow.test.js plans/foundation-followups.md
git commit -m "ci: deploy the leaderboard and the game to GitHub Pages

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Rollout (controller, after the final review; each step needs the user's explicit go-ahead)

1. Merge the branch into `main` locally and run `npm test`.
2. Check the `gh` token has the `workflow` scope (`gh auth status`); if not, the user runs `! gh auth refresh -s workflow`.
3. Switch the Pages source to GitHub Actions: `gh api -X PUT repos/JouniJokelainen/winter-games/pages -f build_type=workflow` (do this immediately before step 4; the site keeps serving until the first Actions deploy finishes, but confirm in the Pages settings).
4. Push `main`: the push triggers the first deploy.
5. Watch the run with `gh run watch`; if no run started, trigger it with `gh workflow run pages.yml`.
6. Open `https://jounijokelainen.github.io/winter-games/` (the leaderboard with a PELAA link) and `…/peli/` (the game); play one competition and confirm `TULOS TALLENNETTU SELAIMEEN`.
