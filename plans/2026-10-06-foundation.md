# Winter Games Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete game shell — local Node server with git-published leaderboard, canvas engine, audio, menus, competition/practice flow and GitHub Pages leaderboard — with placeholder events that later plans replace with ski jump, slalom and luge.

**Architecture:** A dependency-free Node server (`server/`) serves the browser game (`game/`) on `127.0.0.1:8080`, accepts finished competition results, writes `docs/leaderboard.json` and commits + pushes it. The browser game is plain ES modules on a 320×256 canvas with a fixed 60 Hz update loop and a scene stack. Rules shared by server and game live in `game/core/rules.js`. GitHub Pages serves `docs/` (static leaderboard page reading `leaderboard.json`).

**Tech Stack:** Node 20 built-ins only (`node:http`, `node:fs`, `node:child_process`, `node:test`), browser Canvas 2D, Web Audio API, git + gh CLI.

**Spec:** `docs/spec.md`

## Global Constraints

- No npm dependencies. Do not run `npm install` of anything. Only Node built-in modules.
- All code, identifiers, comments and commit messages in English. All player-visible game text in Finnish, UPPERCASE (bitmap font has only uppercase glyphs).
- Never store API keys or tokens in code or files. Git pushes use the machine's existing git credentials.
- Internal resolution 320×256, integer scaling, all graphics drawn in code (no image files).
- Fixed update step 1/60 s.
- Shared rule constants come only from `game/core/rules.js` (`EVENT_IDS`, `MAX_POINTS`, `METRIC_KEY`, `ATTEMPTS_PER_EVENT`, `SKI_JUMP_MAX_DISTANCE = 200`, `TARGET_TIME_SECONDS = 30`, nickname rules: max 10 chars from `A–Z ÄÖÅ 0–9`).
- Event points floor at 0. All attempts failed → event gives 0 points.
- Server listens on `127.0.0.1`, port `8080` (env `PORT` overrides).
- Tests: `npm test` (= `node --test`), test files `tests/**/*.test.js`.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Creating the GitHub repo / enabling Pages is outward-facing: ask the user before doing it.

## File Structure

```
package.json                     npm scripts only (start, test), "type": "module"
.gitignore
server/
  server.js                      entry: wires app + publisher, listens
  app.js                         HTTP handler: static files, GET /api/leaderboard, POST /api/results
  leaderboard.js                 pure: validateResult, applyResult, topTotals, eventRecords, emptyBoard
  leaderboardStore.js            loadBoard / saveBoard (atomic write)
  publisher.js                   serialized git add/commit/push
game/
  index.html                     canvas page
  main.js                        bootstrap + main loop wiring
  flow.js                        navigation between scenes (competition + practice flow)
  engine/
    constants.js                 SCREEN_WIDTH, SCREEN_HEIGHT, FIXED_STEP
    loop.js                      createFixedStepper, startLoop
    input.js                     Input (keyboard state, edge presses, typed chars)
    sceneManager.js              SceneManager (stack)
    screen.js                    createScreen, integerScale
    rng.js                       createRng (seeded)
    palette.js                   PALETTE
    font.js                      5×7 bitmap font: drawText, textWidth
    draw.js                      drawWinterBackdrop, drawPanel, drawBlinking, Snowfall
  audio/
    sequencer.js                 noteToFreq, parsePattern, Sequencer
    songs.js                     TITLE_THEME, EVENT_THEME
    sfx.js                       SFX table
    audioEngine.js               AudioEngine
  core/
    rules.js                     shared constants + nickname rules
    scoring.js                   points formulas, bestAttempt, eventResult
    competition.js               Competition state
    format.js                    formatTime, formatDistance, describeEventResult, LANDING_LABEL
    nicknameEntry.js             NicknameEntry
    scoreRepository.js           HttpScoreRepository
  ui/
    menu.js                      Menu, visibleWindow
  scenes/
    infoScene.js                 generic title + lines + "press space" screen
    titleScene.js
    nicknameScene.js
    practiceSelectScene.js
    pauseScene.js
    finalScene.js
  events/
    registry.js                  EVENTS (id, name, instructions, createScene)
    placeholderEvent.js          PlaceholderEventScene, SIMULATORS
docs/
  spec.md                        (exists)
  index.html                     Pages leaderboard page
  style.css
  main.js                        fetches leaderboard.json and renders
  leaderboard-view.js            pure renderLeaderboard(board) → HTML string
  leaderboard.json               data written by the server
  .nojekyll
tests/                           mirrors source tree, *.test.js
```

### Contract for event scenes (used by later plans)

An event is registered in `game/events/registry.js` as:

```js
{ id, name, instructions: string[], createScene({ game, mode, attemptNumber, onComplete }) }
```

- `game` = `{ scenes, input, audio, repository }`
- `mode` = `'competition' | 'practice'`
- The scene implements `update(dt, input)` and `render(ctx)` (optionally `enter()`, `exit()`), and calls `onComplete(attempt)` exactly once.
- `attempt` = `{ valid: boolean, points: number, distance?: number, time?: number, summary: string[] }`. Ski jump sets `distance`, slalom and luge set `time`. `valid: false` = fall / disqualified. `summary` = Finnish uppercase lines for the result screen.
- Flow sets `scene.onPauseQuit`; Esc opens the pause menu for any scene that has it.

---

### Task 1: Project setup, shared rules and scoring

**Files:**
- Create: `package.json`, `.gitignore`, `game/core/rules.js`, `game/core/scoring.js`
- Test: `tests/core/rules.test.js`, `tests/core/scoring.test.js`

**Interfaces:**
- Produces: `rules.js` exports `EVENT_IDS`, `MAX_POINTS`, `METRIC_KEY`, `ATTEMPTS_PER_EVENT`, `SKI_JUMP_MAX_DISTANCE`, `TARGET_TIME_SECONDS`, `NICKNAME_MAX_LENGTH`, `NICKNAME_CHARS`, `normalizeNickname(raw): string`, `isValidNickname(s): boolean`.
- Produces: `scoring.js` exports `LANDING_POINTS`, `skiJumpPoints(distance, landing: 'perfect'|'poor'|'fall'): number`, `overtimeSeconds(time): number`, `slalomPoints({ time, hits, missed }): number`, `lugePoints(time): number`, `bestAttempt(eventId, attempts): attempt|null`, `eventResult(eventId, attempts): { points, distance|time }`.

- [ ] **Step 1: Initialize repository and project files**

```bash
cd C:/Users/jouni.jokelainen/claude/winter_games
git init -b main
```

`package.json`:

```json
{
  "name": "winter-games",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server/server.js",
    "test": "node --test"
  },
  "engines": {
    "node": ">=20"
  }
}
```

`.gitignore`:

```
node_modules/
*.tmp
.DS_Store
```

- [ ] **Step 2: Write the failing tests**

`tests/core/rules.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidNickname, normalizeNickname } from '../../game/core/rules.js';

test('normalizeNickname trims and uppercases', () => {
  assert.equal(normalizeNickname('  jöni '), 'JÖNI');
  assert.equal(normalizeNickname(undefined), '');
});

test('isValidNickname accepts A-Z, ÄÖÅ and digits up to 10 chars', () => {
  assert.equal(isValidNickname('ÄIJÄ2026'), true);
  assert.equal(isValidNickname('ABCDEFGHIJ'), true);
});

test('isValidNickname rejects empty, too long and other characters', () => {
  for (const bad of ['', 'ABCDEFGHIJK', 'A B', 'abc', 'A-1', 42]) {
    assert.equal(isValidNickname(bad), false, String(bad));
  }
});
```

`tests/core/scoring.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestAttempt, eventResult, lugePoints, overtimeSeconds, skiJumpPoints, slalomPoints,
} from '../../game/core/scoring.js';

test('skiJumpPoints: 200 m perfect landing is the maximum 80', () => {
  assert.equal(skiJumpPoints(200, 'perfect'), 80);
});

test('skiJumpPoints: each full metre under 200 costs 2 points', () => {
  assert.equal(skiJumpPoints(199.9, 'perfect'), 78);
  assert.equal(skiJumpPoints(199, 'poor'), 63);
  assert.equal(skiJumpPoints(170, 'perfect'), 20);
});

test('skiJumpPoints: distance points floor at 0, fall gives 0', () => {
  assert.equal(skiJumpPoints(150, 'poor'), 5);
  assert.equal(skiJumpPoints(195, 'fall'), 0);
});

test('overtimeSeconds counts every started second over 30', () => {
  assert.equal(overtimeSeconds(29.5), 0);
  assert.equal(overtimeSeconds(30), 0);
  assert.equal(overtimeSeconds(30.01), 1);
  assert.equal(overtimeSeconds(31), 1);
  assert.equal(overtimeSeconds(31.5), 2);
});

test('slalomPoints subtracts overtime, hits and missed poles, floors at 0', () => {
  assert.equal(slalomPoints({ time: 30, hits: 0, missed: 0 }), 60);
  assert.equal(slalomPoints({ time: 32.4, hits: 1, missed: 1 }), 15);
  assert.equal(slalomPoints({ time: 45, hits: 3, missed: 1 }), 0);
});

test('lugePoints subtracts overtime only', () => {
  assert.equal(lugePoints(28), 60);
  assert.equal(lugePoints(33.2), 40);
  assert.equal(lugePoints(60), 0);
});

test('bestAttempt ski jump: highest points, then longest distance, invalid ignored', () => {
  const attempts = [
    { valid: true, points: 60, distance: 190 },
    { valid: false, points: 0, distance: 199 },
    { valid: true, points: 60, distance: 190.5 },
  ];
  assert.equal(bestAttempt('skiJump', attempts), attempts[2]);
});

test('bestAttempt slalom prefers points over raw speed', () => {
  const attempts = [
    { valid: true, points: 40, time: 29 },
    { valid: true, points: 50, time: 31 },
  ];
  assert.equal(bestAttempt('slalom', attempts), attempts[1]);
});

test('bestAttempt luge picks the fastest valid run', () => {
  const attempts = [
    { valid: true, points: 45, time: 32.5 },
    { valid: false, points: 0, time: 20 },
    { valid: true, points: 50, time: 31.9 },
  ];
  assert.equal(bestAttempt('luge', attempts), attempts[2]);
});

test('bestAttempt returns null when nothing is valid', () => {
  assert.equal(bestAttempt('luge', [{ valid: false, points: 0, time: 30 }]), null);
});

test('eventResult returns points and metric of the best attempt or zero with null metric', () => {
  assert.deepEqual(eventResult('skiJump', [{ valid: true, points: 62, distance: 196.5 }]), { points: 62, distance: 196.5 });
  assert.deepEqual(eventResult('slalom', []), { points: 0, time: null });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for `game/core/rules.js` and `game/core/scoring.js`.

- [ ] **Step 4: Implement**

`game/core/rules.js`:

```js
export const EVENT_IDS = ['skiJump', 'slalom', 'luge'];
export const MAX_POINTS = { skiJump: 80, slalom: 60, luge: 60 };
export const METRIC_KEY = { skiJump: 'distance', slalom: 'time', luge: 'time' };
export const ATTEMPTS_PER_EVENT = 3;
export const SKI_JUMP_MAX_DISTANCE = 200;
export const TARGET_TIME_SECONDS = 30;
export const NICKNAME_MAX_LENGTH = 10;
export const NICKNAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÅ0123456789';

export function normalizeNickname(raw) {
  return String(raw ?? '').trim().toUpperCase();
}

export function isValidNickname(nickname) {
  return typeof nickname === 'string'
    && nickname.length >= 1
    && nickname.length <= NICKNAME_MAX_LENGTH
    && [...nickname].every((char) => NICKNAME_CHARS.includes(char));
}
```

`game/core/scoring.js`:

```js
import { METRIC_KEY, SKI_JUMP_MAX_DISTANCE, TARGET_TIME_SECONDS } from './rules.js';

export const LANDING_POINTS = { perfect: 20, poor: 5, fall: 0 };

export function skiJumpPoints(distance, landing) {
  if (landing === 'fall') return 0;
  const metres = Math.min(SKI_JUMP_MAX_DISTANCE, Math.floor(distance));
  const distancePoints = Math.max(0, 60 - 2 * (SKI_JUMP_MAX_DISTANCE - metres));
  return distancePoints + LANDING_POINTS[landing];
}

// Every started second over the target costs points; epsilon absorbs float noise.
export function overtimeSeconds(time) {
  return Math.max(0, Math.ceil(time - TARGET_TIME_SECONDS - 1e-9));
}

export function slalomPoints({ time, hits, missed }) {
  return Math.max(0, 60 - 5 * overtimeSeconds(time) - 10 * hits - 20 * missed);
}

export function lugePoints(time) {
  return Math.max(0, 60 - 5 * overtimeSeconds(time));
}

function isBetterAttempt(eventId, candidate, current) {
  if (eventId === 'luge') return candidate.time < current.time;
  if (candidate.points !== current.points) return candidate.points > current.points;
  if (eventId === 'skiJump') return candidate.distance > current.distance;
  return candidate.time < current.time;
}

export function bestAttempt(eventId, attempts) {
  const valid = attempts.filter((attempt) => attempt.valid);
  if (valid.length === 0) return null;
  return valid.reduce((best, attempt) => (isBetterAttempt(eventId, attempt, best) ? attempt : best));
}

export function eventResult(eventId, attempts) {
  const metricKey = METRIC_KEY[eventId];
  const best = bestAttempt(eventId, attempts);
  return best ? { points: best.points, [metricKey]: best[metricKey] } : { points: 0, [metricKey]: null };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore game/core/rules.js game/core/scoring.js tests/core docs/spec.md suunnitelma.txt plans
git commit -m "feat: add shared rules and scoring" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Leaderboard domain logic

**Files:**
- Create: `server/leaderboard.js`
- Test: `tests/server/leaderboard.test.js`

**Interfaces:**
- Consumes: `EVENT_IDS`, `MAX_POINTS`, `METRIC_KEY`, `SKI_JUMP_MAX_DISTANCE`, `normalizeNickname`, `isValidNickname` from `game/core/rules.js`.
- Produces:
  - `emptyBoard(): Board`
  - `validateResult(payload): { ok: true, value: Result } | { ok: false, error: string }`
  - `applyResult(board, result, isoDate): Board` (pure, does not mutate)
  - `isBetterRecord(eventId, candidate, current): boolean`
  - `topTotals(users, limit = 10)`, `eventRecords(users)`
  - `RECENT_LIMIT = 20`, `TOP_LIMIT = 10`
  - `Result = { nickname, events: { skiJump: { points, distance }, slalom: { points, time }, luge: { points, time } } }` (metric may be `null`)
  - `Board = { version: 1, users: { [nickname]: { bestTotal, competitions, records: { [eventId]: { points, distance|time, date } } } }, recent: [{ nickname, date, total, events }], top: [{ nickname, total }], eventRecords: { [eventId]: { nickname, points, distance|time, date } } }`

- [ ] **Step 1: Write the failing test**

`tests/server/leaderboard.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyResult, emptyBoard, RECENT_LIMIT, topTotals, validateResult,
} from '../../server/leaderboard.js';

function makeResult(nickname, [skiJump, slalom, luge]) {
  return {
    nickname,
    events: {
      skiJump: { points: skiJump[0], distance: skiJump[1] },
      slalom: { points: slalom[0], time: slalom[1] },
      luge: { points: luge[0], time: luge[1] },
    },
  };
}

const DATE = '2026-10-06T12:00:00.000Z';

test('validateResult accepts a well-formed payload and normalizes the nickname', () => {
  const outcome = validateResult(makeResult('jouni', [[60, 190], [30, 35.2], [30, 35.9]]));
  assert.equal(outcome.ok, true);
  assert.equal(outcome.value.nickname, 'JOUNI');
  assert.deepEqual(outcome.value.events.slalom, { points: 30, time: 35.2 });
});

test('validateResult accepts null metrics for failed events', () => {
  assert.equal(validateResult(makeResult('A', [[0, null], [0, null], [0, null]])).ok, true);
});

test('validateResult rejects bad payloads', () => {
  const cases = [
    null,
    'text',
    makeResult('', [[60, 190], [30, 35], [30, 35]]),
    makeResult('A B', [[60, 190], [30, 35], [30, 35]]),
    makeResult('A', [[81, 200], [30, 35], [30, 35]]),
    makeResult('A', [[60, 201], [30, 35], [30, 35]]),
    makeResult('A', [[60, 190], [61, 35], [30, 35]]),
    makeResult('A', [[60, 190], [30, -1], [30, 35]]),
    makeResult('A', [[60, 190], [30, 35], [1.5, 35]]),
    { nickname: 'A' },
  ];
  for (const payload of cases) {
    assert.equal(validateResult(payload).ok, false, JSON.stringify(payload));
  }
});

test('applyResult adds a new user, recent entry, top list and event records', () => {
  const board = applyResult(emptyBoard(), makeResult('JOUNI', [[60, 190], [30, 35.2], [40, 33.1]]), DATE);
  assert.deepEqual(board.users.JOUNI, {
    bestTotal: 130,
    competitions: 1,
    records: {
      skiJump: { points: 60, distance: 190, date: DATE },
      slalom: { points: 30, time: 35.2, date: DATE },
      luge: { points: 40, time: 33.1, date: DATE },
    },
  });
  assert.deepEqual(board.recent[0], { nickname: 'JOUNI', date: DATE, total: 130, events: makeResult('JOUNI', [[60, 190], [30, 35.2], [40, 33.1]]).events });
  assert.deepEqual(board.top, [{ nickname: 'JOUNI', total: 130 }]);
  assert.equal(board.eventRecords.luge.nickname, 'JOUNI');
});

test('applyResult keeps the best total and only improves records', () => {
  let board = applyResult(emptyBoard(), makeResult('JOUNI', [[60, 190], [30, 35.2], [40, 33.1]]), DATE);
  board = applyResult(board, makeResult('JOUNI', [[70, 195], [20, 37.0], [0, null]]), '2026-10-07T12:00:00.000Z');
  const user = board.users.JOUNI;
  assert.equal(user.bestTotal, 130);
  assert.equal(user.competitions, 2);
  assert.equal(user.records.skiJump.distance, 195);
  assert.equal(user.records.slalom.time, 35.2);
  assert.equal(user.records.luge.time, 33.1);
  assert.equal(board.recent.length, 2);
  assert.equal(board.recent[0].total, 90);
});

test('applyResult does not store records for failed events', () => {
  const board = applyResult(emptyBoard(), makeResult('A', [[0, null], [0, null], [0, null]]), DATE);
  assert.deepEqual(board.users.A.records, {});
  assert.deepEqual(board.eventRecords, {});
});

test('applyResult does not mutate the input board', () => {
  const board = applyResult(emptyBoard(), makeResult('A', [[60, 190], [30, 35], [30, 35]]), DATE);
  const snapshot = structuredClone(board);
  applyResult(board, makeResult('B', [[70, 195], [40, 33], [40, 33]]), DATE);
  assert.deepEqual(board, snapshot);
});

test('recent list is capped', () => {
  let board = emptyBoard();
  for (let i = 0; i < RECENT_LIMIT + 5; i++) {
    board = applyResult(board, makeResult('A', [[i % 80, 190], [0, null], [0, null]]), DATE);
  }
  assert.equal(board.recent.length, RECENT_LIMIT);
});

test('topTotals sorts by total then nickname and limits', () => {
  const users = {
    B: { bestTotal: 100, competitions: 1, records: {} },
    A: { bestTotal: 100, competitions: 1, records: {} },
    C: { bestTotal: 150, competitions: 1, records: {} },
  };
  assert.deepEqual(topTotals(users, 2), [{ nickname: 'C', total: 150 }, { nickname: 'A', total: 100 }]);
});

test('eventRecords picks the best record across users', () => {
  let board = applyResult(emptyBoard(), makeResult('A', [[60, 190], [30, 35], [30, 35.5]]), DATE);
  board = applyResult(board, makeResult('B', [[60, 190.5], [20, 36], [30, 35.1]]), DATE);
  assert.equal(board.eventRecords.skiJump.nickname, 'B');
  assert.equal(board.eventRecords.slalom.nickname, 'A');
  assert.equal(board.eventRecords.luge.nickname, 'B');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../server/leaderboard.js'`.

- [ ] **Step 3: Implement**

`server/leaderboard.js`:

```js
import {
  EVENT_IDS, isValidNickname, MAX_POINTS, METRIC_KEY, normalizeNickname, SKI_JUMP_MAX_DISTANCE,
} from '../game/core/rules.js';

export const RECENT_LIMIT = 20;
export const TOP_LIMIT = 10;

export function emptyBoard() {
  return { version: 1, users: {}, recent: [], top: [], eventRecords: {} };
}

function fail(error) {
  return { ok: false, error };
}

function isValidMetric(eventId, value) {
  if (value === null) return true;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false;
  return eventId !== 'skiJump' || value <= SKI_JUMP_MAX_DISTANCE;
}

export function validateResult(payload) {
  if (!payload || typeof payload !== 'object') return fail('payload must be an object');
  const nickname = normalizeNickname(payload.nickname);
  if (!isValidNickname(nickname)) return fail('invalid nickname');
  if (!payload.events || typeof payload.events !== 'object') return fail('events missing');

  const events = {};
  for (const eventId of EVENT_IDS) {
    const event = payload.events[eventId];
    if (!event || !Number.isInteger(event.points) || event.points < 0 || event.points > MAX_POINTS[eventId]) {
      return fail(`invalid points for ${eventId}`);
    }
    const metricKey = METRIC_KEY[eventId];
    const metric = event[metricKey] ?? null;
    if (!isValidMetric(eventId, metric)) return fail(`invalid ${metricKey} for ${eventId}`);
    events[eventId] = { points: event.points, [metricKey]: metric };
  }
  return { ok: true, value: { nickname, events } };
}

export function isBetterRecord(eventId, candidate, current) {
  if (!current) return true;
  if (candidate.points !== current.points) return candidate.points > current.points;
  const metricKey = METRIC_KEY[eventId];
  return eventId === 'skiJump'
    ? candidate[metricKey] > current[metricKey]
    : candidate[metricKey] < current[metricKey];
}

export function topTotals(users, limit = TOP_LIMIT) {
  return Object.entries(users)
    .map(([nickname, user]) => ({ nickname, total: user.bestTotal }))
    .sort((a, b) => b.total - a.total || a.nickname.localeCompare(b.nickname, 'fi'))
    .slice(0, limit);
}

export function eventRecords(users) {
  const best = {};
  for (const eventId of EVENT_IDS) {
    for (const [nickname, user] of Object.entries(users)) {
      const record = user.records[eventId];
      if (record && isBetterRecord(eventId, record, best[eventId])) best[eventId] = { nickname, ...record };
    }
  }
  return best;
}

export function applyResult(board, result, date) {
  const total = EVENT_IDS.reduce((sum, eventId) => sum + result.events[eventId].points, 0);
  const previous = board.users[result.nickname] ?? { bestTotal: 0, competitions: 0, records: {} };

  const records = { ...previous.records };
  for (const eventId of EVENT_IDS) {
    const candidate = result.events[eventId];
    if (candidate[METRIC_KEY[eventId]] !== null && isBetterRecord(eventId, candidate, records[eventId])) {
      records[eventId] = { ...candidate, date };
    }
  }

  const users = {
    ...board.users,
    [result.nickname]: {
      bestTotal: Math.max(previous.bestTotal, total),
      competitions: previous.competitions + 1,
      records,
    },
  };
  const recent = [{ nickname: result.nickname, date, total, events: result.events }, ...board.recent]
    .slice(0, RECENT_LIMIT);

  return { version: 1, users, recent, top: topTotals(users), eventRecords: eventRecords(users) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/leaderboard.js tests/server/leaderboard.test.js
git commit -m "feat: add leaderboard validation and aggregation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Leaderboard store and git publisher

**Files:**
- Create: `server/leaderboardStore.js`, `server/publisher.js`
- Test: `tests/server/leaderboardStore.test.js`, `tests/server/publisher.test.js`

**Interfaces:**
- Consumes: `emptyBoard()` from `server/leaderboard.js`.
- Produces:
  - `loadBoard(path): Promise<Board>` (missing file → `emptyBoard()`)
  - `saveBoard(path, board): Promise<void>` (pretty JSON + trailing newline, written via temp file + rename)
  - `runCommand(cmd, args, cwd): Promise<string>`
  - `createPublisher({ repoDir, filePath, run = runCommand, log = console }): { publish(message): Promise<{ committed: boolean, pushed: boolean }> }` — publishes are serialized; push failure resolves with `pushed: false`; add/commit failure rejects.

- [ ] **Step 1: Write the failing tests**

`tests/server/leaderboardStore.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyBoard } from '../../server/leaderboard.js';
import { loadBoard, saveBoard } from '../../server/leaderboardStore.js';

async function tempDir(t) {
  const dir = await mkdtemp(join(tmpdir(), 'wg-store-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('loadBoard returns an empty board when the file is missing', async (t) => {
  const dir = await tempDir(t);
  assert.deepEqual(await loadBoard(join(dir, 'missing.json')), emptyBoard());
});

test('saveBoard writes pretty JSON that loadBoard reads back', async (t) => {
  const dir = await tempDir(t);
  const path = join(dir, 'leaderboard.json');
  const board = { ...emptyBoard(), top: [{ nickname: 'A', total: 10 }] };
  await saveBoard(path, board);
  await saveBoard(path, board);
  assert.deepEqual(await loadBoard(path), board);
  const text = await readFile(path, 'utf8');
  assert.ok(text.endsWith('}\n'));
  assert.ok(text.includes('\n  "version": 1'));
});
```

`tests/server/publisher.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublisher } from '../../server/publisher.js';

function fakeRunner({ failOn = null } = {}) {
  const calls = [];
  async function run(cmd, args, cwd) {
    calls.push([cmd, ...args].join(' ') + ` @${cwd}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (failOn && args[0] === failOn) {
      throw Object.assign(new Error(`${failOn} failed`), { stderr: 'boom' });
    }
    return '';
  }
  return { run, calls };
}

const silentLog = { warn() {} };

test('publish adds, commits only the leaderboard file and pushes', async () => {
  const { run, calls } = fakeRunner();
  const publisher = createPublisher({ repoDir: '/repo', filePath: 'docs/leaderboard.json', run, log: silentLog });
  assert.deepEqual(await publisher.publish('results: A 10'), { committed: true, pushed: true });
  assert.deepEqual(calls, [
    'git add docs/leaderboard.json @/repo',
    'git commit -m results: A 10 -- docs/leaderboard.json @/repo',
    'git push @/repo',
  ]);
});

test('push failure is reported but not thrown', async () => {
  const { run } = fakeRunner({ failOn: 'push' });
  const warnings = [];
  const publisher = createPublisher({ repoDir: '/repo', filePath: 'f.json', run, log: { warn: (m) => warnings.push(m) } });
  assert.deepEqual(await publisher.publish('m'), { committed: true, pushed: false });
  assert.match(warnings[0], /git push failed: boom/);
});

test('commit failure rejects', async () => {
  const { run } = fakeRunner({ failOn: 'commit' });
  const publisher = createPublisher({ repoDir: '/repo', filePath: 'f.json', run, log: silentLog });
  await assert.rejects(publisher.publish('m'), /commit failed/);
});

test('publishes are serialized', async () => {
  const { run, calls } = fakeRunner();
  const publisher = createPublisher({ repoDir: '/r', filePath: 'f.json', run, log: silentLog });
  await Promise.all([publisher.publish('one'), publisher.publish('two')]);
  assert.deepEqual(calls.map((c) => c.split(' ')[1]), ['add', 'commit', 'push', 'add', 'commit', 'push']);
  assert.match(calls[1], /one/);
  assert.match(calls[4], /two/);
});

test('a failed publish does not block the next one', async () => {
  let fail = true;
  const calls = [];
  const run = async (cmd, args) => {
    calls.push(args[0]);
    if (fail && args[0] === 'commit') { fail = false; throw new Error('commit failed'); }
    return '';
  };
  const publisher = createPublisher({ repoDir: '/r', filePath: 'f.json', run, log: silentLog });
  await assert.rejects(publisher.publish('one'));
  assert.deepEqual(await publisher.publish('two'), { committed: true, pushed: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for `leaderboardStore.js` and `publisher.js`.

- [ ] **Step 3: Implement**

`server/leaderboardStore.js`:

```js
import { readFile, rename, writeFile } from 'node:fs/promises';
import { emptyBoard } from './leaderboard.js';

export async function loadBoard(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return emptyBoard();
    throw err;
  }
}

export async function saveBoard(path, board) {
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(board, null, 2)}\n`, 'utf8');
  await rename(tempPath, path);
}
```

`server/publisher.js`:

```js
import { execFile } from 'node:child_process';

const GIT_TIMEOUT_MS = 30_000;

export function runCommand(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { cwd, timeout: GIT_TIMEOUT_MS, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (err, stdout, stderr) => (err ? reject(Object.assign(err, { stderr })) : resolve(stdout)),
    );
  });
}

export function createPublisher({ repoDir, filePath, run = runCommand, log = console }) {
  let queue = Promise.resolve();

  async function publishNow(message) {
    await run('git', ['add', filePath], repoDir);
    await run('git', ['commit', '-m', message, '--', filePath], repoDir);
    try {
      await run('git', ['push'], repoDir);
      return { committed: true, pushed: true };
    } catch (err) {
      log.warn(`git push failed: ${err.stderr || err.message}`);
      return { committed: true, pushed: false };
    }
  }

  return {
    publish(message) {
      const job = queue.then(() => publishNow(message));
      queue = job.catch(() => {});
      return job;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/leaderboardStore.js server/publisher.js tests/server
git commit -m "feat: add leaderboard file store and git publisher" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: HTTP app and server entry

**Files:**
- Create: `server/app.js`, `server/server.js`, `docs/leaderboard.json`, `game/index.html` (temporary minimal page, replaced in Task 10)
- Test: `tests/server/app.test.js`

**Interfaces:**
- Consumes: `validateResult`, `applyResult` (Task 2); `loadBoard`, `saveBoard` (Task 3); publisher object with `publish(message)` (Task 3).
- Produces: `createApp({ staticDir, leaderboardPath, publisher, now = () => new Date() }): (req, res) => Promise<void>`
  - `GET /api/leaderboard` → 200 Board JSON
  - `POST /api/results` (body = Result payload) → 200 `{ saved: true, committed, pushed, user }`; 400 `{ error }` on invalid JSON/payload
  - `GET /<path>` → file from `staticDir` (`/` → `index.html`), 404 missing, 403 outside `staticDir`
  - Publish commit message: `results: <NICKNAME> <total>`

- [ ] **Step 1: Write the failing test**

`tests/server/app.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../server/app.js';

async function startApp(t, { publisher } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'wg-app-'));
  const staticDir = join(dir, 'game');
  await mkdir(staticDir);
  await writeFile(join(staticDir, 'index.html'), '<h1>peli</h1>');
  await writeFile(join(dir, 'secret.txt'), 'secret');
  const leaderboardPath = join(dir, 'leaderboard.json');
  const messages = [];
  const app = createApp({
    staticDir,
    leaderboardPath,
    publisher: publisher ?? { publish: async (message) => { messages.push(message); return { committed: true, pushed: true }; } },
    now: () => new Date('2026-10-06T12:00:00.000Z'),
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${server.address().port}`, leaderboardPath, messages };
}

const VALID = {
  nickname: 'jouni',
  events: {
    skiJump: { points: 60, distance: 190 },
    slalom: { points: 30, time: 35.2 },
    luge: { points: 30, time: 35.9 },
  },
};

function post(base, body) {
  return fetch(`${base}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('serves index.html for /', async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(await res.text(), '<h1>peli</h1>');
});

test('returns 404 for missing files and 403 for paths outside the static dir', async (t) => {
  const { base } = await startApp(t);
  assert.equal((await fetch(`${base}/nope.js`)).status, 404);
  // %2f is not normalized by the URL parser, so the server sees and must block "../secret.txt".
  assert.equal((await fetch(`${base}/..%2fsecret.txt`)).status, 403);
});

test('GET /api/leaderboard returns an empty board initially', async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(`${base}/api/leaderboard`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { version: 1, users: {}, recent: [], top: [], eventRecords: {} });
});

test('POST /api/results saves, publishes and returns the user', async (t) => {
  const { base, leaderboardPath, messages } = await startApp(t);
  const res = await post(base, VALID);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.saved, true);
  assert.equal(body.pushed, true);
  assert.equal(body.user.bestTotal, 120);
  assert.deepEqual(messages, ['results: JOUNI 120']);
  const stored = JSON.parse(await readFile(leaderboardPath, 'utf8'));
  assert.equal(stored.recent[0].date, '2026-10-06T12:00:00.000Z');
});

test('POST /api/results rejects invalid payloads without writing', async (t) => {
  const { base, leaderboardPath, messages } = await startApp(t);
  assert.equal((await post(base, { ...VALID, nickname: '' })).status, 400);
  assert.equal((await post(base, '{not json')).status, 400);
  await assert.rejects(readFile(leaderboardPath, 'utf8'), { code: 'ENOENT' });
  assert.deepEqual(messages, []);
});

test('POST /api/results still saves when publishing throws', async (t) => {
  const publisher = { publish: async () => { throw new Error('not a git repo'); } };
  const { base, leaderboardPath } = await startApp(t, { publisher });
  const res = await post(base, VALID);
  assert.equal(res.status, 200);
  assert.deepEqual(
    { saved: true, committed: false, pushed: false },
    (({ saved, committed, pushed }) => ({ saved, committed, pushed }))(await res.json()),
  );
  assert.ok(JSON.parse(await readFile(leaderboardPath, 'utf8')).users.JOUNI);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../server/app.js'`.

- [ ] **Step 3: Implement**

`server/app.js`:

```js
import { readFile } from 'node:fs/promises';
import { extname, normalize, resolve, sep } from 'node:path';
import { applyResult, validateResult } from './leaderboard.js';
import { loadBoard, saveBoard } from './leaderboardStore.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};
const MAX_BODY_BYTES = 10_000;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME_TYPES['.json'], 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createApp({ staticDir, leaderboardPath, publisher, now = () => new Date() }) {
  const root = resolve(staticDir);
  let writeQueue = Promise.resolve();

  async function handleResult(req, res) {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: 'invalid json' });
      return;
    }
    const validation = validateResult(payload);
    if (!validation.ok) {
      sendJson(res, 400, { error: validation.error });
      return;
    }
    const result = validation.value;

    const job = writeQueue.then(async () => {
      const board = applyResult(await loadBoard(leaderboardPath), result, now().toISOString());
      await saveBoard(leaderboardPath, board);
      return board;
    });
    writeQueue = job.catch(() => {});
    const board = await job;

    let publishStatus = { committed: false, pushed: false };
    try {
      publishStatus = await publisher.publish(`results: ${result.nickname} ${board.recent[0].total}`);
    } catch (err) {
      console.warn(`publish failed: ${err.message}`);
    }
    sendJson(res, 200, { saved: true, ...publishStatus, user: board.users[result.nickname] });
  }

  async function serveStatic(pathname, res) {
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const filePath = resolve(root, normalize(relative));
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      sendJson(res, 403, { error: 'forbidden' });
      return;
    }
    try {
      const data = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      throw err;
    }
  }

  return async function handle(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
        sendJson(res, 200, await loadBoard(leaderboardPath));
      } else if (url.pathname === '/api/results' && req.method === 'POST') {
        await handleResult(req, res);
      } else if (req.method === 'GET') {
        await serveStatic(url.pathname, res);
      } else {
        sendJson(res, 405, { error: 'method not allowed' });
      }
    } catch (err) {
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, { error: 'internal error' });
    }
  };
}
```

`server/server.js`:

```js
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createPublisher } from './publisher.js';

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 8080);

const app = createApp({
  staticDir: join(repoDir, 'game'),
  leaderboardPath: join(repoDir, 'docs', 'leaderboard.json'),
  publisher: createPublisher({ repoDir, filePath: 'docs/leaderboard.json' }),
});

createServer(app).listen(port, '127.0.0.1', () => {
  console.log(`Winter Games running at http://127.0.0.1:${port}`);
});
```

`docs/leaderboard.json`:

```json
{
  "version": 1,
  "users": {},
  "recent": [],
  "top": [],
  "eventRecords": {}
}
```

`game/index.html` (temporary, replaced in Task 10):

```html
<!doctype html>
<html lang="fi">
<head><meta charset="utf-8"><title>Winter Games</title></head>
<body><p>WINTER GAMES</p></body>
</html>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Smoke-test the real server**

Run in background: `npm start`
Then: `curl -s http://127.0.0.1:8080/api/leaderboard`
Expected: the empty board JSON. Stop the server afterwards.

- [ ] **Step 6: Commit**

```bash
git add server/app.js server/server.js docs/leaderboard.json game/index.html tests/server/app.test.js
git commit -m "feat: add HTTP server for game files and results" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Engine core (loop, input, scenes, screen, rng)

**Files:**
- Create: `game/engine/constants.js`, `game/engine/loop.js`, `game/engine/input.js`, `game/engine/sceneManager.js`, `game/engine/screen.js`, `game/engine/rng.js`
- Test: `tests/engine/loop.test.js`, `tests/engine/input.test.js`, `tests/engine/sceneManager.test.js`, `tests/engine/screen.test.js`, `tests/engine/rng.test.js`

**Interfaces:**
- Produces:
  - `constants.js`: `SCREEN_WIDTH = 320`, `SCREEN_HEIGHT = 256`, `FIXED_STEP = 1 / 60`
  - `loop.js`: `createFixedStepper(step, maxSteps = 5): (elapsedSeconds, tick: (dt) => void) => number`, `startLoop({ step, update(dt), render() })`
  - `input.js`: `class Input(target?)` with `onKeyDown(event)`, `onKeyUp(event)`, `reset()`, `isDown(code)`, `wasPressed(code)`, `takeTyped(): string[]`, `endFrame()`. Codes are `KeyboardEvent.code` values (`'Space'`, `'ArrowLeft'`, `'ArrowRight'`, `'ArrowUp'`, `'ArrowDown'`, `'Escape'`, `'Enter'`, `'Backspace'`).
  - `sceneManager.js`: `class SceneManager` with `current`, `replace(scene)`, `push(scene)`, `pop()`, `update(dt, input)`, `render(ctx)`
  - `screen.js`: `integerScale(viewportWidth, viewportHeight): number`, `createScreen(canvas): CanvasRenderingContext2D`
  - `rng.js`: `createRng(seed): () => number` in [0, 1)

- [ ] **Step 1: Write the failing tests**

`tests/engine/loop.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixedStepper } from '../../game/engine/loop.js';

test('runs one tick per whole step and carries the remainder', () => {
  const advance = createFixedStepper(0.25);
  const ticks = [];
  assert.equal(advance(0.5, (dt) => ticks.push(dt)), 2);
  assert.equal(advance(0.125, (dt) => ticks.push(dt)), 0);
  assert.equal(advance(0.125, (dt) => ticks.push(dt)), 1);
  assert.deepEqual(ticks, [0.25, 0.25, 0.25]);
});

test('clamps long pauses to maxSteps', () => {
  const advance = createFixedStepper(0.25, 5);
  assert.equal(advance(10, () => {}), 5);
});
```

`tests/engine/input.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../../game/engine/input.js';

function key(code, keyValue = '', repeat = false) {
  return { code, key: keyValue, repeat, prevented: false, preventDefault() { this.prevented = true; } };
}

test('keydown sets down and pressed, endFrame clears only pressed', () => {
  const input = new Input();
  input.onKeyDown(key('Space', ' '));
  assert.equal(input.isDown('Space'), true);
  assert.equal(input.wasPressed('Space'), true);
  input.endFrame();
  assert.equal(input.wasPressed('Space'), false);
  assert.equal(input.isDown('Space'), true);
  input.onKeyUp(key('Space'));
  assert.equal(input.isDown('Space'), false);
});

test('auto-repeat does not create new presses', () => {
  const input = new Input();
  input.onKeyDown(key('ArrowLeft'));
  input.endFrame();
  input.onKeyDown(key('ArrowLeft', '', true));
  assert.equal(input.wasPressed('ArrowLeft'), false);
});

test('game keys prevent default browser behaviour, others do not', () => {
  const input = new Input();
  const space = key('Space', ' ');
  const letter = key('KeyA', 'a');
  input.onKeyDown(space);
  input.onKeyDown(letter);
  assert.equal(space.prevented, true);
  assert.equal(letter.prevented, false);
});

test('typed characters are collected and drained', () => {
  const input = new Input();
  input.onKeyDown(key('KeyA', 'a'));
  input.onKeyDown(key('Quote', 'ä'));
  input.onKeyDown(key('Enter', 'Enter'));
  assert.deepEqual(input.takeTyped(), ['a', 'ä']);
  assert.deepEqual(input.takeTyped(), []);
});

test('reset clears held keys', () => {
  const input = new Input();
  input.onKeyDown(key('ArrowRight'));
  input.reset();
  assert.equal(input.isDown('ArrowRight'), false);
});
```

`tests/engine/sceneManager.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SceneManager } from '../../game/engine/sceneManager.js';

function scene(name, log) {
  return {
    enter: () => log.push(`enter ${name}`),
    exit: () => log.push(`exit ${name}`),
    update: () => log.push(`update ${name}`),
    render: () => log.push(`render ${name}`),
  };
}

test('replace exits all scenes and enters the new one', () => {
  const log = [];
  const manager = new SceneManager();
  manager.push(scene('a', log));
  manager.push(scene('b', log));
  manager.replace(scene('c', log));
  assert.deepEqual(log, ['enter a', 'enter b', 'exit b', 'exit a', 'enter c']);
});

test('only the top scene updates, all scenes render bottom-up', () => {
  const log = [];
  const manager = new SceneManager();
  manager.push(scene('a', log));
  manager.push(scene('b', log));
  log.length = 0;
  manager.update(1 / 60, {});
  manager.render({});
  assert.deepEqual(log, ['update b', 'render a', 'render b']);
});

test('pop removes the top scene and exits it', () => {
  const log = [];
  const manager = new SceneManager();
  const a = scene('a', log);
  manager.push(a);
  manager.push(scene('b', log));
  manager.pop();
  assert.equal(manager.current, a);
  assert.equal(log.at(-1), 'exit b');
});

test('scenes without enter/exit hooks are fine', () => {
  const manager = new SceneManager();
  manager.replace({ update() {}, render() {} });
  manager.pop();
  assert.equal(manager.current, null);
});
```

`tests/engine/screen.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integerScale } from '../../game/engine/screen.js';

test('integerScale picks the largest whole multiple that fits', () => {
  assert.equal(integerScale(1920, 1080), 4);
  assert.equal(integerScale(1280, 1024), 4);
  assert.equal(integerScale(1279, 1024), 3);
});

test('integerScale never goes below 1', () => {
  assert.equal(integerScale(300, 200), 1);
});
```

`tests/engine/rng.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../game/engine/rng.js';

test('same seed gives the same sequence in [0, 1)', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 100; i++) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});

test('different seeds give different sequences', () => {
  assert.notEqual(createRng(1)(), createRng(2)());
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for the engine files.

- [ ] **Step 3: Implement**

`game/engine/constants.js`:

```js
export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 256;
export const FIXED_STEP = 1 / 60;
```

`game/engine/loop.js`:

```js
export function createFixedStepper(step, maxSteps = 5) {
  let accumulator = 0;
  return function advance(elapsedSeconds, tick) {
    accumulator += Math.min(elapsedSeconds, step * maxSteps);
    let steps = 0;
    while (accumulator >= step) {
      tick(step);
      accumulator -= step;
      steps += 1;
    }
    return steps;
  };
}

export function startLoop({ step, update, render }) {
  const advance = createFixedStepper(step);
  let last = performance.now();
  function frame(now) {
    advance((now - last) / 1000, update);
    last = now;
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
```

`game/engine/input.js`:

```js
const GAME_KEYS = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'Enter', 'Backspace']);

export class Input {
  constructor(target = null) {
    this.down = new Set();
    this.pressed = new Set();
    this.typed = [];
    if (target) {
      target.addEventListener('keydown', (event) => this.onKeyDown(event));
      target.addEventListener('keyup', (event) => this.onKeyUp(event));
      target.addEventListener('blur', () => this.reset());
    }
  }

  onKeyDown(event) {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (!event.repeat) this.pressed.add(event.code);
    this.down.add(event.code);
    if (event.key.length === 1) this.typed.push(event.key);
  }

  onKeyUp(event) {
    this.down.delete(event.code);
  }

  reset() {
    this.down.clear();
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  takeTyped() {
    const typed = this.typed;
    this.typed = [];
    return typed;
  }

  // Call once after every fixed update tick so a press is seen by exactly one tick.
  endFrame() {
    this.pressed.clear();
  }
}
```

`game/engine/sceneManager.js`:

```js
export class SceneManager {
  constructor() {
    this.stack = [];
  }

  get current() {
    return this.stack.at(-1) ?? null;
  }

  replace(scene) {
    while (this.stack.length > 0) this.stack.pop().exit?.();
    this.push(scene);
  }

  push(scene) {
    this.stack.push(scene);
    scene.enter?.();
  }

  pop() {
    const scene = this.stack.pop();
    scene?.exit?.();
    return scene;
  }

  update(dt, input) {
    this.current?.update(dt, input);
  }

  render(ctx) {
    for (const scene of this.stack) scene.render(ctx);
  }
}
```

`game/engine/screen.js`:

```js
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './constants.js';

export function integerScale(viewportWidth, viewportHeight) {
  return Math.max(1, Math.floor(Math.min(viewportWidth / SCREEN_WIDTH, viewportHeight / SCREEN_HEIGHT)));
}

export function createScreen(canvas) {
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  function fit() {
    const scale = integerScale(window.innerWidth, window.innerHeight);
    canvas.style.width = `${SCREEN_WIDTH * scale}px`;
    canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
  }
  window.addEventListener('resize', fit);
  fit();
  return ctx;
}
```

`game/engine/rng.js`:

```js
// mulberry32: small, fast, deterministic PRNG.
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add game/engine tests/engine
git commit -m "feat: add engine loop, input, scene stack and screen scaling" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Palette, bitmap font and drawing helpers

**Files:**
- Create: `game/engine/palette.js`, `game/engine/font.js`, `game/engine/draw.js`
- Test: `tests/engine/font.test.js`

**Interfaces:**
- Consumes: `SCREEN_WIDTH`, `SCREEN_HEIGHT` (Task 5), `createRng` (Task 5).
- Produces:
  - `PALETTE` object with keys: `black, night, navy, blue, sky, skyLight, ice, white, snowShadow, grey, darkGrey, red, darkRed, orange, yellow, green, darkGreen, pine, brown, skin, purple, pink, gold, cyan`
  - `font.js`: `GLYPH_WIDTH = 5`, `GLYPH_HEIGHT = 7`, `GLYPH_ADVANCE = 6`, `GLYPHS`, `glyphFor(char): string[]`, `textWidth(text, scale = 1): number`, `drawText(ctx, text, x, y, { color, scale, align: 'left'|'center'|'right', shadow })`
  - `draw.js`: `drawWinterBackdrop(ctx)`, `drawPanel(ctx, x, y, w, h)`, `drawBlinking(ctx, text, x, y, time, options)`, `class Snowfall(count = 60, seed = 7)` with `update(dt)`, `render(ctx)`

- [ ] **Step 1: Write the failing test**

`tests/engine/font.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawText, GLYPHS, glyphFor, textWidth } from '../../game/engine/font.js';

function recordingCtx() {
  const rects = [];
  return {
    rects,
    fillStyle: null,
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, color: this.fillStyle }); },
  };
}

test('every glyph is 7 rows of 5 characters using # and .', () => {
  for (const [char, rows] of Object.entries(GLYPHS)) {
    assert.equal(rows.length, 7, char);
    for (const row of rows) assert.match(row, /^[#.]{5}$/, char);
  }
});

test('font covers the Finnish alphabet, digits and common punctuation', () => {
  for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÅ0123456789 .,:-+!?/()\'%=<>_°') {
    assert.ok(GLYPHS[char], `missing glyph ${char}`);
  }
});

test('lowercase maps to uppercase and unknown characters to ?', () => {
  assert.equal(glyphFor('ä'), GLYPHS['Ä']);
  assert.equal(glyphFor('@'), GLYPHS['?']);
});

test('textWidth uses a 6 px advance without trailing spacing', () => {
  assert.equal(textWidth(''), 0);
  assert.equal(textWidth('A'), 5);
  assert.equal(textWidth('AB'), 11);
  assert.equal(textWidth('AB', 2), 22);
});

test('drawText paints one rect per lit pixel, scaled and aligned', () => {
  const ctx = recordingCtx();
  drawText(ctx, 'I', 10, 20, { color: '#fff' });
  assert.equal(ctx.rects.length, 11);
  assert.deepEqual(ctx.rects[0], { x: 11, y: 20, w: 1, h: 1, color: '#fff' });

  const centered = recordingCtx();
  drawText(centered, 'I', 100, 0, { scale: 2, align: 'center' });
  assert.equal(Math.min(...centered.rects.map((r) => r.x)), 95 + 2);
  assert.equal(centered.rects[0].w, 2);
});

test('drawText draws the shadow first, offset by scale', () => {
  const ctx = recordingCtx();
  drawText(ctx, '.', 0, 0, { color: '#fff', shadow: '#000' });
  const shadowRects = ctx.rects.filter((r) => r.color === '#000');
  const textRects = ctx.rects.filter((r) => r.color === '#fff');
  assert.equal(ctx.rects[0].color, '#000');
  assert.equal(shadowRects.length, textRects.length);
  assert.equal(shadowRects[0].x, textRects[0].x + 1);
  assert.equal(shadowRects[0].y, textRects[0].y + 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../game/engine/font.js'`.

- [ ] **Step 3: Implement**

`game/engine/palette.js`:

```js
// Amiga-inspired palette; every game graphic picks colours from here.
export const PALETTE = {
  black: '#000000',
  night: '#101028',
  navy: '#202060',
  blue: '#3050b0',
  sky: '#6090e0',
  skyLight: '#a0c8f0',
  ice: '#d0e8f8',
  white: '#ffffff',
  snowShadow: '#b8c8e0',
  grey: '#808890',
  darkGrey: '#404850',
  red: '#d02020',
  darkRed: '#801010',
  orange: '#f08020',
  yellow: '#f0e040',
  green: '#30a040',
  darkGreen: '#105020',
  pine: '#183828',
  brown: '#704020',
  skin: '#f0b090',
  purple: '#8040a0',
  pink: '#f080b0',
  gold: '#e0b030',
  cyan: '#40d0e0',
};
```

`game/engine/font.js`:

```js
export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;
export const GLYPH_ADVANCE = 6;

// Each glyph: 7 rows of 5 pixels separated by "/", "#" = lit.
const RAW_GLYPHS = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.####',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '.###./..#../..#../..#../..#../..#../.###.',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/#...#/##..#/#.#.#/#..##/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  Ä: '.#.#./...../.###./#...#/#####/#...#/#...#',
  Ö: '.#.#./...../.###./#...#/#...#/#...#/.###.',
  Å: '..#../...../.###./#...#/#####/#...#/#...#',
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  1: '..#../.##../..#../..#../..#../..#../.###.',
  2: '.###./#...#/....#/...#./..#../.#.../#####',
  3: '####./....#/....#/.###./....#/....#/####.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.',
  5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '.###./#..../#..../####./#...#/#...#/.###.',
  7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
  9: '.###./#...#/#...#/.####/....#/....#/.###.',
  ' ': '...../...../...../...../...../...../.....',
  '.': '...../...../...../...../...../.##../.##..',
  ',': '...../...../...../...../.##../..#../.#...',
  ':': '...../.##../.##../...../.##../.##../.....',
  '-': '...../...../...../.###./...../...../.....',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
  ')': '.#.../..#../...#./...#./...#./..#../.#...',
  "'": '..#../..#../...../...../...../...../.....',
  '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
  '=': '...../...../#####/...../#####/...../.....',
  '<': '...#./..#../.#.../#..../.#.../..#../...#.',
  '>': '.#.../..#../...#./....#/...#./..#../.#...',
  _: '...../...../...../...../...../...../#####',
  '°': '.##../#..#./.##../...../...../...../.....',
};

export const GLYPHS = Object.fromEntries(
  Object.entries(RAW_GLYPHS).map(([char, rows]) => [char, rows.split('/')]),
);

export function glyphFor(char) {
  return GLYPHS[char.toUpperCase()] ?? GLYPHS['?'];
}

export function textWidth(text, scale = 1) {
  const length = [...String(text)].length;
  return length === 0 ? 0 : (length * GLYPH_ADVANCE - 1) * scale;
}

function paint(ctx, chars, x, y, color, scale) {
  ctx.fillStyle = color;
  chars.forEach((char, index) => {
    const rows = glyphFor(char);
    for (let row = 0; row < GLYPH_HEIGHT; row++) {
      for (let col = 0; col < GLYPH_WIDTH; col++) {
        if (rows[row][col] === '#') {
          ctx.fillRect(x + (index * GLYPH_ADVANCE + col) * scale, y + row * scale, scale, scale);
        }
      }
    }
  });
}

export function drawText(ctx, text, x, y, { color = '#ffffff', scale = 1, align = 'left', shadow = null } = {}) {
  const chars = [...String(text)];
  const width = textWidth(text, scale);
  const offset = align === 'center' ? width / 2 : align === 'right' ? width : 0;
  const left = Math.round(x - offset);
  if (shadow) paint(ctx, chars, left + scale, y + scale, shadow, scale);
  paint(ctx, chars, left, y, color, scale);
}
```

Note on the centred test: `textWidth('I', 2) = 10`, so `left = 100 - 5 = 95`; the first lit column of `I` is column 1 → `95 + 1 * 2 = 97`.

`game/engine/draw.js`:

```js
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './constants.js';
import { drawText } from './font.js';
import { PALETTE } from './palette.js';
import { createRng } from './rng.js';

const HORIZON_Y = 180;
const SKY_BANDS = [PALETTE.night, PALETTE.navy, PALETTE.blue, PALETTE.sky, PALETTE.skyLight];

function mountainHeight(x) {
  return 38 + 22 * Math.sin(x * 0.031) + 12 * Math.sin(x * 0.073 + 1.3);
}

function drawPine(ctx, x, baseY, height) {
  ctx.fillStyle = PALETTE.pine;
  for (let row = 0; row < height; row++) {
    const half = Math.floor((row * 4) / height) + Math.floor(row / 3) % 2;
    ctx.fillRect(x - half, baseY - height + row, half * 2 + 1, 1);
  }
  ctx.fillStyle = PALETTE.brown;
  ctx.fillRect(x, baseY, 1, 2);
}

export function drawWinterBackdrop(ctx) {
  const bandHeight = HORIZON_Y / SKY_BANDS.length;
  SKY_BANDS.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, Math.floor(index * bandHeight), SCREEN_WIDTH, Math.ceil(bandHeight));
  });
  for (let x = 0; x < SCREEN_WIDTH; x++) {
    const height = Math.round(mountainHeight(x));
    ctx.fillStyle = PALETTE.snowShadow;
    ctx.fillRect(x, HORIZON_Y - height, 1, height);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(x, HORIZON_Y - height, 1, Math.min(5, height));
  }
  for (let x = 6; x < SCREEN_WIDTH; x += 23) drawPine(ctx, x, HORIZON_Y - 2, 12 + (x % 3) * 3);
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(0, HORIZON_Y, SCREEN_WIDTH, SCREEN_HEIGHT - HORIZON_Y);
  ctx.fillStyle = PALETTE.ice;
  for (let y = HORIZON_Y + 4; y < SCREEN_HEIGHT; y += 9) ctx.fillRect(0, y, SCREEN_WIDTH, 1);
}

export function drawPanel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.skyLight;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
}

export function drawBlinking(ctx, text, x, y, time, options = {}) {
  if (Math.floor(time * 2) % 2 === 0) drawText(ctx, text, x, y, { align: 'center', ...options });
}

export class Snowfall {
  constructor(count = 60, seed = 7) {
    const rng = createRng(seed);
    this.time = 0;
    this.flakes = Array.from({ length: count }, () => ({
      x: rng() * SCREEN_WIDTH,
      y: rng() * SCREEN_HEIGHT,
      speed: 10 + rng() * 25,
      phase: rng() * Math.PI * 2,
    }));
  }

  update(dt) {
    this.time += dt;
    for (const flake of this.flakes) {
      flake.y += flake.speed * dt;
      if (flake.y > SCREEN_HEIGHT) flake.y -= SCREEN_HEIGHT + 2;
    }
  }

  render(ctx) {
    ctx.fillStyle = PALETTE.white;
    for (const flake of this.flakes) {
      const x = (flake.x + Math.sin(this.time + flake.phase) * 4 + SCREEN_WIDTH) % SCREEN_WIDTH;
      ctx.fillRect(Math.floor(x), Math.floor(flake.y), 1, 1);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add game/engine/palette.js game/engine/font.js game/engine/draw.js tests/engine/font.test.js
git commit -m "feat: add palette, bitmap font and winter backdrop" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Audio engine, sequencer, songs and sound effects

**Files:**
- Create: `game/audio/sequencer.js`, `game/audio/songs.js`, `game/audio/sfx.js`, `game/audio/audioEngine.js`
- Test: `tests/audio/sequencer.test.js`, `tests/audio/songs.test.js`

**Interfaces:**
- Produces:
  - `sequencer.js`: `noteToFreq(note: 'C4'|'A#3'…): number`, `parsePattern(pattern): { notes: [{ step, length, freq }], length }`, `class Sequencer(audio, song)` with `start()`, `stop()`
  - Pattern syntax: whitespace-separated tokens, one per 16th-note step. Note token = `C4`, `D#5` (sharps only). `.` = rest. `-` = hold the previous note one more step.
  - Song shape: `{ bpm, stepsPerBeat, channels: [{ wave: OscillatorType, volume, pattern }] }`; all channels of a song have the same length, a multiple of 16.
  - `songs.js`: `TITLE_THEME`, `EVENT_THEME`
  - `sfx.js`: `SFX` with keys `select, confirm, back, jump, land, crash, hit, push, warning, finish, fail, tick`; each is `(audio) => void`
  - `audioEngine.js`: `class AudioEngine(storage = null)` with `muted`, `unlock()`, `toggleMuted()`, `tone({ wave, freq, freqEnd, duration, volume, delay, at, destination })`, `noise({ duration, volume, delay, filterFreq, destination })`, `playSfx(name)`, `playSong(song)`, `stopSong()`, fields `ctx`, `master`.
  - Mute is persisted in storage key `winterGames.muted` (`'1'`/`'0'`).

- [ ] **Step 1: Write the failing tests**

`tests/audio/sequencer.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteToFreq, parsePattern } from '../../game/audio/sequencer.js';

test('noteToFreq uses A4 = 440 Hz equal temperament', () => {
  assert.equal(noteToFreq('A4'), 440);
  assert.ok(Math.abs(noteToFreq('C4') - 261.63) < 0.01);
  assert.ok(Math.abs(noteToFreq('A#4') - 466.16) < 0.01);
  assert.ok(Math.abs(noteToFreq('A3') - 220) < 1e-9);
});

test('noteToFreq rejects invalid notes', () => {
  for (const bad of ['H4', 'E#4', 'Bb4', 'C', '']) assert.throws(() => noteToFreq(bad), /invalid note/);
});

test('parsePattern handles notes, rests and holds', () => {
  const { notes, length } = parsePattern('C4 - . E4\n G4');
  assert.equal(length, 5);
  assert.deepEqual(notes.map(({ step, length: l }) => [step, l]), [[0, 2], [3, 1], [4, 1]]);
  assert.equal(notes[1].freq, noteToFreq('E4'));
});

test('parsePattern rejects a hold without a note', () => {
  assert.throws(() => parsePattern('. -'), /hold without note/);
  assert.throws(() => parsePattern('- C4'), /hold without note/);
});
```

`tests/audio/songs.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePattern } from '../../game/audio/sequencer.js';
import { EVENT_THEME, TITLE_THEME } from '../../game/audio/songs.js';

for (const [name, song] of Object.entries({ TITLE_THEME, EVENT_THEME })) {
  test(`${name} channels parse and share a whole-bar length`, () => {
    const lengths = song.channels.map((channel) => parsePattern(channel.pattern).length);
    assert.ok(lengths.every((length) => length === lengths[0]), lengths.join(','));
    assert.equal(lengths[0] % 16, 0);
    assert.ok(song.bpm > 0 && song.stepsPerBeat > 0);
  });
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for `sequencer.js` / `songs.js`.

- [ ] **Step 3: Implement**

`game/audio/sequencer.js`:

```js
const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const LOOKAHEAD_SECONDS = 0.6;
const TIMER_MS = 100;

export function noteToFreq(note) {
  const match = /^([A-G]#?)(\d)$/.exec(note);
  if (!match || !(match[1] in NOTE_INDEX)) throw new Error(`invalid note: ${note}`);
  const midi = (Number(match[2]) + 1) * 12 + NOTE_INDEX[match[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

export function parsePattern(pattern) {
  const tokens = pattern.trim().split(/\s+/);
  const notes = [];
  tokens.forEach((token, step) => {
    if (token === '.') return;
    if (token === '-') {
      const last = notes.at(-1);
      if (!last || last.step + last.length !== step) throw new Error(`hold without note at step ${step}`);
      last.length += 1;
      return;
    }
    notes.push({ step, length: 1, freq: noteToFreq(token) });
  });
  return { notes, length: tokens.length };
}

export class Sequencer {
  constructor(audio, song) {
    this.audio = audio;
    this.stepSeconds = 60 / song.bpm / song.stepsPerBeat;
    this.tracks = song.channels.map((channel) => ({ ...channel, ...parsePattern(channel.pattern) }));
    this.loopSteps = Math.max(...this.tracks.map((track) => track.length));
    this.output = null;
    this.timer = null;
    this.nextLoopTime = 0;
  }

  start() {
    const { ctx, master } = this.audio;
    this.output = ctx.createGain();
    this.output.connect(master);
    this.nextLoopTime = ctx.currentTime + 0.1;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), TIMER_MS);
  }

  // Schedules whole loops ahead of time; stop() disconnects the output so queued notes go silent.
  schedule() {
    const { ctx } = this.audio;
    while (this.nextLoopTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      for (const track of this.tracks) {
        for (const note of track.notes) {
          this.audio.tone({
            wave: track.wave,
            freq: note.freq,
            duration: note.length * this.stepSeconds * 0.9,
            volume: track.volume,
            at: this.nextLoopTime + note.step * this.stepSeconds,
            destination: this.output,
          });
        }
      }
      this.nextLoopTime += this.loopSteps * this.stepSeconds;
    }
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.output?.disconnect();
    this.output = null;
  }
}
```

`game/audio/songs.js`:

```js
const TITLE_LEAD = [
  'E5 - . E5 G5 - E5 . D5 - C5 - D5 - - .',
  'E5 - . E5 G5 - A5 . G5 - E5 - D5 - - .',
  'C5 - . C5 E5 - G5 . A5 - G5 - E5 - - .',
  'D5 - E5 - D5 - B4 - C5 - - - . . . .',
];
const TITLE_BASS = [
  'C3 . C3 . G2 . G2 . A2 . A2 . G2 . G2 .',
  'C3 . C3 . E3 . E3 . F3 . F3 . G3 . G3 .',
  'A2 . A2 . E3 . E3 . F3 . F3 . C3 . C3 .',
  'G2 . G2 . G2 . G2 . C3 . G2 . C3 . . .',
];

const EVENT_LEAD = [
  'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .',
  'F5 . D5 . A4 . D5 . E5 - - . B4 . E5 .',
];
const EVENT_BASS = [
  'A2 . A2 A3 A2 . A2 A3 A2 . A2 A3 A2 . A2 A3',
  'D3 . D3 D2 D3 . D3 D2 E2 . E2 E3 E2 . E2 E3',
];

export const TITLE_THEME = {
  bpm: 132,
  stepsPerBeat: 4,
  channels: [
    { wave: 'square', volume: 0.07, pattern: TITLE_LEAD.join(' ') },
    { wave: 'triangle', volume: 0.14, pattern: TITLE_BASS.join(' ') },
  ],
};

export const EVENT_THEME = {
  bpm: 150,
  stepsPerBeat: 4,
  channels: [
    { wave: 'square', volume: 0.05, pattern: EVENT_LEAD.join(' ') },
    { wave: 'triangle', volume: 0.12, pattern: EVENT_BASS.join(' ') },
  ],
};
```

`game/audio/sfx.js`:

```js
export const SFX = {
  select: (audio) => audio.tone({ wave: 'square', freq: 660, duration: 0.05, volume: 0.15 }),
  confirm: (audio) => {
    audio.tone({ wave: 'square', freq: 660, duration: 0.06, volume: 0.15 });
    audio.tone({ wave: 'square', freq: 990, duration: 0.08, volume: 0.15, delay: 0.06 });
  },
  back: (audio) => audio.tone({ wave: 'square', freq: 440, freqEnd: 220, duration: 0.1, volume: 0.15 }),
  jump: (audio) => audio.tone({ wave: 'square', freq: 300, freqEnd: 900, duration: 0.25, volume: 0.2 }),
  land: (audio) => audio.noise({ duration: 0.2, volume: 0.3, filterFreq: 1200 }),
  crash: (audio) => {
    audio.noise({ duration: 0.6, volume: 0.4, filterFreq: 600 });
    audio.tone({ wave: 'sawtooth', freq: 200, freqEnd: 50, duration: 0.5, volume: 0.2 });
  },
  hit: (audio) => audio.tone({ wave: 'square', freq: 180, freqEnd: 120, duration: 0.08, volume: 0.25 }),
  push: (audio) => audio.noise({ duration: 0.05, volume: 0.15, filterFreq: 3000 }),
  warning: (audio) => audio.noise({ duration: 0.3, volume: 0.25, filterFreq: 5000 }),
  finish: (audio) => [523, 659, 784, 1047].forEach((freq, index) => {
    audio.tone({ wave: 'square', freq, duration: 0.12, volume: 0.18, delay: index * 0.12 });
  }),
  fail: (audio) => [392, 330, 262].forEach((freq, index) => {
    audio.tone({ wave: 'triangle', freq, duration: 0.2, volume: 0.25, delay: index * 0.2 });
  }),
  tick: (audio) => audio.tone({ wave: 'square', freq: 1200, duration: 0.03, volume: 0.1 }),
};
```

`game/audio/audioEngine.js`:

```js
import { Sequencer } from './sequencer.js';
import { SFX } from './sfx.js';

const MASTER_VOLUME = 0.5;
const MUTE_KEY = 'winterGames.muted';

function readMuted(storage) {
  try {
    return storage?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function createNoiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class AudioEngine {
  constructor(storage = null) {
    this.storage = storage;
    this.muted = readMuted(storage);
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.wantedSong = null;
    this.sequencer = null;
  }

  // Browsers only allow audio after a user gesture; main.js calls this on every keydown.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = createNoiseBuffer(this.ctx);
    if (this.wantedSong) this.startSequencer(this.wantedSong);
  }

  toggleMuted() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    try {
      this.storage?.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Storage may be unavailable; mute still works for this session.
    }
  }

  tone({ wave = 'square', freq, freqEnd = freq, duration, volume = 0.2, delay = 0, at = null, destination = this.master }) {
    if (!this.ctx) return;
    const start = at ?? this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(freq, start);
    if (freqEnd !== freq) oscillator.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  noise({ duration, volume = 0.2, delay = 0, filterFreq = 2000, destination = this.master }) {
    if (!this.ctx) return;
    const start = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(gain).connect(destination);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  playSfx(name) {
    SFX[name]?.(this);
  }

  playSong(song) {
    if (this.wantedSong === song) return;
    this.wantedSong = song;
    if (this.ctx) this.startSequencer(song);
  }

  stopSong() {
    this.wantedSong = null;
    this.sequencer?.stop();
    this.sequencer = null;
  }

  startSequencer(song) {
    this.sequencer?.stop();
    this.sequencer = new Sequencer(this, song);
    this.sequencer.start();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add game/audio tests/audio
git commit -m "feat: add Web Audio engine, chiptune sequencer and sound effects" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Game-side core (competition, formatting, nickname entry, repository, menu)

**Files:**
- Create: `game/core/competition.js`, `game/core/format.js`, `game/core/nicknameEntry.js`, `game/core/scoreRepository.js`, `game/ui/menu.js`
- Test: `tests/core/competition.test.js`, `tests/core/format.test.js`, `tests/core/nicknameEntry.test.js`, `tests/core/scoreRepository.test.js`, `tests/ui/menu.test.js`, `tests/helpers/fakeInput.js`

**Interfaces:**
- Consumes: `rules.js`, `scoring.js` (Task 1); font `drawText` (Task 6); `PALETTE` (Task 6).
- Produces:
  - `class Competition(nickname, eventIds = EVENT_IDS)`: `nickname`, `eventIds`, `eventIndex`, `currentEventId`, `attemptNumber` (1-based next attempt), `recordAttempt(attempt)` (throws `event already complete`), `isEventComplete()`, `advance()`, `isFinished`, `eventResult(eventId)`, `total`, `toPayload(): Result`
  - `format.js`: `formatTime(seconds): '31,26 S'`, `formatDistance(metres): '187,5 M'`, `describeEventResult(eventId, result): string`, `LANDING_LABEL = { perfect: 'TÄYDELLINEN', poor: 'HUONO', fall: 'KAATUMINEN' }`
  - `class NicknameEntry`: `value`, `append(char): boolean`, `backspace()`, `isValid`
  - `class HttpScoreRepository(fetchFn?)`: `getLeaderboard()`, `getNicknames(): Promise<string[]>` (sorted, Finnish collation), `getUser(nickname)`, `saveResult(payload): Promise<{ saved, committed, pushed, user }>` (throws `Error(body.error)` on non-OK)
  - `menu.js`: `visibleWindow(count, index, maxVisible): [start, end]`, `class Menu(items, { onMove })` where item = `{ label: string | () => string, value }`; `index`, `selected`, `update(input): item | null` (ArrowUp/ArrowDown wrap and call `onMove`; Space/Enter return selected), `render(ctx, centerX, y, { lineHeight = 12, maxVisible = Infinity })`
  - `tests/helpers/fakeInput.js`: `fakeInput(pressedCodes = [], typed = [])`

- [ ] **Step 1: Write the failing tests**

`tests/helpers/fakeInput.js`:

```js
export function fakeInput(pressedCodes = [], typed = []) {
  const pressed = new Set(pressedCodes);
  let pending = [...typed];
  return {
    wasPressed: (code) => pressed.has(code),
    isDown: (code) => pressed.has(code),
    takeTyped: () => {
      const result = pending;
      pending = [];
      return result;
    },
  };
}
```

`tests/core/competition.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Competition } from '../../game/core/competition.js';

test('runs events in order with three attempts each', () => {
  const competition = new Competition('JOUNI');
  assert.equal(competition.currentEventId, 'skiJump');
  assert.equal(competition.attemptNumber, 1);
  competition.recordAttempt({ valid: true, points: 50, distance: 194.5 });
  competition.recordAttempt({ valid: false, points: 0, distance: 120 });
  assert.equal(competition.attemptNumber, 3);
  assert.equal(competition.isEventComplete(), false);
  competition.recordAttempt({ valid: true, points: 70, distance: 197 });
  assert.equal(competition.isEventComplete(), true);
  assert.throws(() => competition.recordAttempt({ valid: true, points: 1, distance: 171 }), /already complete/);
  competition.advance();
  assert.equal(competition.currentEventId, 'slalom');
  assert.equal(competition.attemptNumber, 1);
  assert.equal(competition.isFinished, false);
  competition.advance();
  competition.advance();
  assert.equal(competition.isFinished, true);
  assert.equal(competition.currentEventId, null);
});

test('total and payload use each event best result', () => {
  const competition = new Competition('JOUNI');
  competition.recordAttempt({ valid: true, points: 70, distance: 197 });
  competition.advance();
  competition.recordAttempt({ valid: true, points: 45, time: 32.1 });
  competition.advance();
  competition.recordAttempt({ valid: false, points: 0, time: 25 });
  competition.advance();
  assert.equal(competition.total, 115);
  assert.deepEqual(competition.toPayload(), {
    nickname: 'JOUNI',
    events: {
      skiJump: { points: 70, distance: 197 },
      slalom: { points: 45, time: 32.1 },
      luge: { points: 0, time: null },
    },
  });
});
```

`tests/core/format.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeEventResult, formatDistance, formatTime } from '../../game/core/format.js';

test('formatTime uses two decimals and a Finnish decimal comma', () => {
  assert.equal(formatTime(31.256), '31,26 S');
  assert.equal(formatTime(29), '29,00 S');
});

test('formatDistance uses one decimal and a Finnish decimal comma', () => {
  assert.equal(formatDistance(187.46), '187,5 M');
  assert.equal(formatDistance(200), '200,0 M');
});

test('describeEventResult describes the best result or its absence', () => {
  assert.equal(describeEventResult('skiJump', { points: 60, distance: 190 }), 'PITUUS 190,0 M');
  assert.equal(describeEventResult('luge', { points: 40, time: 33.2 }), 'AIKA 33,20 S');
  assert.equal(describeEventResult('skiJump', { points: 0, distance: null }), 'EI ONNISTUNUTTA HYPPYÄ');
  assert.equal(describeEventResult('slalom', { points: 0, time: null }), 'EI HYVÄKSYTTYÄ LASKUA');
});
```

`tests/core/nicknameEntry.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NicknameEntry } from '../../game/core/nicknameEntry.js';

test('append uppercases allowed characters and rejects others', () => {
  const entry = new NicknameEntry();
  assert.equal(entry.append('j'), true);
  assert.equal(entry.append('ö'), true);
  assert.equal(entry.append('1'), true);
  assert.equal(entry.append(' '), false);
  assert.equal(entry.append('-'), false);
  assert.equal(entry.append('ß'), false);
  assert.equal(entry.value, 'JÖ1');
});

test('append stops at 10 characters', () => {
  const entry = new NicknameEntry();
  for (const char of 'ABCDEFGHIJ') entry.append(char);
  assert.equal(entry.append('K'), false);
  assert.equal(entry.value, 'ABCDEFGHIJ');
});

test('backspace and isValid', () => {
  const entry = new NicknameEntry();
  assert.equal(entry.isValid, false);
  entry.append('A');
  assert.equal(entry.isValid, true);
  entry.backspace();
  entry.backspace();
  assert.equal(entry.value, '');
  assert.equal(entry.isValid, false);
});
```

`tests/core/scoreRepository.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpScoreRepository } from '../../game/core/scoreRepository.js';

function fakeFetch(responses) {
  const calls = [];
  async function fetchFn(url, options = {}) {
    calls.push({ url, options });
    const { status = 200, body } = responses[url];
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }
  return { fetchFn, calls };
}

const BOARD = {
  version: 1,
  users: { ÖRKKI: { bestTotal: 10 }, AKU: { bestTotal: 50 }, ÄIJÄ: { bestTotal: 20 } },
  recent: [],
  top: [],
  eventRecords: {},
};

test('getNicknames returns user names in Finnish alphabetical order', async () => {
  const { fetchFn } = fakeFetch({ '/api/leaderboard': { body: BOARD } });
  const repository = new HttpScoreRepository(fetchFn);
  assert.deepEqual(await repository.getNicknames(), ['AKU', 'ÄIJÄ', 'ÖRKKI']);
});

test('getUser returns the user or null', async () => {
  const { fetchFn } = fakeFetch({ '/api/leaderboard': { body: BOARD } });
  const repository = new HttpScoreRepository(fetchFn);
  assert.deepEqual(await repository.getUser('AKU'), { bestTotal: 50 });
  assert.equal(await repository.getUser('NOBODY'), null);
});

test('saveResult posts JSON and returns the server response', async () => {
  const { fetchFn, calls } = fakeFetch({ '/api/results': { body: { saved: true, pushed: true } } });
  const repository = new HttpScoreRepository(fetchFn);
  const payload = { nickname: 'AKU', events: {} };
  assert.deepEqual(await repository.saveResult(payload), { saved: true, pushed: true });
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
});

test('non-OK responses throw with the server error message', async () => {
  const { fetchFn } = fakeFetch({
    '/api/results': { status: 400, body: { error: 'invalid nickname' } },
    '/api/leaderboard': { status: 500, body: {} },
  });
  const repository = new HttpScoreRepository(fetchFn);
  await assert.rejects(repository.saveResult({}), /invalid nickname/);
  await assert.rejects(repository.getLeaderboard(), /HTTP 500/);
});
```

`tests/ui/menu.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Menu, visibleWindow } from '../../game/ui/menu.js';
import { fakeInput } from '../helpers/fakeInput.js';

const items = () => [{ label: 'A', value: 1 }, { label: 'B', value: 2 }, { label: () => 'C', value: 3 }];

test('arrow keys move the selection with wrap-around and notify', () => {
  let moves = 0;
  const menu = new Menu(items(), { onMove: () => { moves += 1; } });
  assert.equal(menu.update(fakeInput(['ArrowDown'])), null);
  assert.equal(menu.index, 1);
  menu.update(fakeInput(['ArrowUp']));
  menu.update(fakeInput(['ArrowUp']));
  assert.equal(menu.index, 2);
  menu.update(fakeInput(['ArrowDown']));
  assert.equal(menu.index, 0);
  assert.equal(moves, 4);
});

test('space or enter returns the selected item', () => {
  const menu = new Menu(items());
  menu.update(fakeInput(['ArrowDown']));
  assert.equal(menu.update(fakeInput(['Space'])).value, 2);
  assert.equal(menu.update(fakeInput(['Enter'])).value, 2);
  assert.equal(menu.update(fakeInput([])), null);
});

test('visibleWindow keeps the selection inside the visible range', () => {
  assert.deepEqual(visibleWindow(5, 0, 8), [0, 5]);
  assert.deepEqual(visibleWindow(20, 0, 8), [0, 8]);
  assert.deepEqual(visibleWindow(20, 10, 8), [6, 14]);
  assert.deepEqual(visibleWindow(20, 19, 8), [12, 20]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for the new files.

- [ ] **Step 3: Implement**

`game/core/competition.js`:

```js
import { ATTEMPTS_PER_EVENT, EVENT_IDS } from './rules.js';
import { eventResult } from './scoring.js';

export class Competition {
  constructor(nickname, eventIds = EVENT_IDS) {
    this.nickname = nickname;
    this.eventIds = eventIds;
    this.eventIndex = 0;
    this.attempts = Object.fromEntries(eventIds.map((eventId) => [eventId, []]));
  }

  get currentEventId() {
    return this.eventIds[this.eventIndex] ?? null;
  }

  get attemptNumber() {
    return this.attempts[this.currentEventId].length + 1;
  }

  get isFinished() {
    return this.eventIndex >= this.eventIds.length;
  }

  get total() {
    return this.eventIds.reduce((sum, eventId) => sum + this.eventResult(eventId).points, 0);
  }

  isEventComplete() {
    return this.attempts[this.currentEventId].length >= ATTEMPTS_PER_EVENT;
  }

  recordAttempt(attempt) {
    if (this.isEventComplete()) throw new Error('event already complete');
    this.attempts[this.currentEventId].push(attempt);
  }

  advance() {
    this.eventIndex += 1;
  }

  eventResult(eventId) {
    return eventResult(eventId, this.attempts[eventId]);
  }

  toPayload() {
    return {
      nickname: this.nickname,
      events: Object.fromEntries(this.eventIds.map((eventId) => [eventId, this.eventResult(eventId)])),
    };
  }
}
```

`game/core/format.js`:

```js
import { METRIC_KEY } from './rules.js';

export const LANDING_LABEL = { perfect: 'TÄYDELLINEN', poor: 'HUONO', fall: 'KAATUMINEN' };

export function formatTime(seconds) {
  return `${seconds.toFixed(2).replace('.', ',')} S`;
}

export function formatDistance(metres) {
  return `${metres.toFixed(1).replace('.', ',')} M`;
}

export function describeEventResult(eventId, result) {
  const value = result[METRIC_KEY[eventId]];
  if (eventId === 'skiJump') return value === null ? 'EI ONNISTUNUTTA HYPPYÄ' : `PITUUS ${formatDistance(value)}`;
  return value === null ? 'EI HYVÄKSYTTYÄ LASKUA' : `AIKA ${formatTime(value)}`;
}
```

`game/core/nicknameEntry.js`:

```js
import { isValidNickname, NICKNAME_CHARS, NICKNAME_MAX_LENGTH, normalizeNickname } from './rules.js';

export class NicknameEntry {
  constructor() {
    this.value = '';
  }

  append(char) {
    const normalized = normalizeNickname(char);
    if (normalized.length !== 1 || !NICKNAME_CHARS.includes(normalized)) return false;
    if (this.value.length >= NICKNAME_MAX_LENGTH) return false;
    this.value += normalized;
    return true;
  }

  backspace() {
    this.value = this.value.slice(0, -1);
  }

  get isValid() {
    return isValidNickname(this.value);
  }
}
```

`game/core/scoreRepository.js`:

```js
export class HttpScoreRepository {
  constructor(fetchFn = (...args) => globalThis.fetch(...args)) {
    this.fetch = fetchFn;
  }

  async getLeaderboard() {
    const response = await this.fetch('/api/leaderboard');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async getNicknames() {
    const board = await this.getLeaderboard();
    return Object.keys(board.users).sort((a, b) => a.localeCompare(b, 'fi'));
  }

  async getUser(nickname) {
    const board = await this.getLeaderboard();
    return board.users[nickname] ?? null;
  }

  async saveResult(payload) {
    const response = await this.fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
    return body;
  }
}
```

`game/ui/menu.js`:

```js
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';

export function visibleWindow(count, index, maxVisible) {
  if (count <= maxVisible) return [0, count];
  const start = Math.min(Math.max(0, index - Math.floor(maxVisible / 2)), count - maxVisible);
  return [start, start + maxVisible];
}

function labelOf(item) {
  return typeof item.label === 'function' ? item.label() : item.label;
}

export class Menu {
  constructor(items, { onMove = () => {} } = {}) {
    this.items = items;
    this.index = 0;
    this.onMove = onMove;
  }

  get selected() {
    return this.items[this.index];
  }

  update(input) {
    const count = this.items.length;
    if (input.wasPressed('ArrowUp')) {
      this.index = (this.index - 1 + count) % count;
      this.onMove();
    } else if (input.wasPressed('ArrowDown')) {
      this.index = (this.index + 1) % count;
      this.onMove();
    } else if (input.wasPressed('Space') || input.wasPressed('Enter')) {
      return this.selected;
    }
    return null;
  }

  render(ctx, centerX, y, { lineHeight = 12, maxVisible = Infinity } = {}) {
    const [start, end] = visibleWindow(this.items.length, this.index, maxVisible);
    for (let i = start; i < end; i++) {
      const isSelected = i === this.index;
      const text = isSelected ? `> ${labelOf(this.items[i])} <` : labelOf(this.items[i]);
      drawText(ctx, text, centerX, y + (i - start) * lineHeight, {
        align: 'center',
        color: isSelected ? PALETTE.yellow : PALETTE.white,
      });
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add game/core game/ui tests/core tests/ui tests/helpers
git commit -m "feat: add competition state, formatting, nickname entry, repository and menu" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Placeholder events and event registry

**Files:**
- Create: `game/events/placeholderEvent.js`, `game/events/registry.js`
- Test: `tests/events/placeholderEvent.test.js`, `tests/events/registry.test.js`

**Interfaces:**
- Consumes: scoring (Task 1), format (Task 8), `createRng` (Task 5), draw helpers and font (Task 6).
- Produces:
  - `SIMULATORS = { skiJump(rng), slalom(rng), luge(rng) }` each returning an `attempt` (see contract at top).
  - `class PlaceholderEventScene({ game, eventId, name, onComplete, rng = Math.random })`: Space → simulated attempt, `onComplete` called once.
  - `EVENTS` registry: `{ skiJump, slalom, luge }` each `{ id, name, instructions, createScene(options) }`. Names: `MÄKIHYPPY`, `PUJOTTELU`, `OHJASKELKKAILU`.

- [ ] **Step 1: Write the failing tests**

`tests/events/placeholderEvent.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../game/engine/rng.js';
import { PlaceholderEventScene, SIMULATORS } from '../../game/events/placeholderEvent.js';
import { MAX_POINTS } from '../../game/core/rules.js';
import { fakeInput } from '../helpers/fakeInput.js';

test('simulators produce attempts that follow the event contract', () => {
  const rng = createRng(123);
  for (let i = 0; i < 200; i++) {
    for (const [eventId, simulate] of Object.entries(SIMULATORS)) {
      const attempt = simulate(rng);
      assert.equal(typeof attempt.valid, 'boolean');
      assert.ok(Number.isInteger(attempt.points));
      assert.ok(attempt.points >= 0 && attempt.points <= MAX_POINTS[eventId]);
      if (!attempt.valid) assert.equal(attempt.points, 0);
      assert.ok(attempt.summary.length > 0);
      if (eventId === 'skiJump') assert.ok(attempt.distance > 0 && attempt.distance <= 200);
      else assert.ok(attempt.time > 0);
    }
  }
});

test('placeholder scene completes exactly once on space', () => {
  const completed = [];
  const game = { audio: { playSfx() {} } };
  const scene = new PlaceholderEventScene({
    game, eventId: 'luge', name: 'OHJASKELKKAILU', onComplete: (a) => completed.push(a), rng: createRng(1),
  });
  scene.update(1 / 60, fakeInput([]));
  assert.equal(completed.length, 0);
  scene.update(1 / 60, fakeInput(['Space']));
  scene.update(1 / 60, fakeInput(['Space']));
  assert.equal(completed.length, 1);
});
```

`tests/events/registry.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS } from '../../game/events/registry.js';
import { EVENT_IDS } from '../../game/core/rules.js';

test('registry has every event with name, instructions and a scene factory', () => {
  assert.deepEqual(Object.keys(EVENTS), EVENT_IDS);
  for (const eventId of EVENT_IDS) {
    const event = EVENTS[eventId];
    assert.equal(event.id, eventId);
    assert.match(event.name, /^[A-ZÄÖÅ]+$/);
    assert.ok(event.instructions.length > 0);
    const scene = event.createScene({ game: { audio: { playSfx() {} } }, mode: 'practice', attemptNumber: 1, onComplete() {} });
    assert.equal(typeof scene.update, 'function');
    assert.equal(typeof scene.render, 'function');
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for the event files.

- [ ] **Step 3: Implement**

`game/events/placeholderEvent.js`:

```js
import { drawBlinking, drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { formatDistance, formatTime, LANDING_LABEL } from '../core/format.js';
import { lugePoints, skiJumpPoints, slalomPoints } from '../core/scoring.js';

const round = (value, decimals) => Math.round(value * 10 ** decimals) / 10 ** decimals;

// Random results so the whole game flow can be played before real events exist.
export const SIMULATORS = {
  skiJump(rng) {
    const distance = round(150 + rng() * 50, 1);
    const landing = ['perfect', 'poor', 'fall'][Math.floor(rng() * 3)];
    const points = skiJumpPoints(distance, landing);
    return {
      valid: landing !== 'fall',
      points,
      distance,
      summary: [`PITUUS ${formatDistance(distance)}`, `ALASTULO ${LANDING_LABEL[landing]}`, `PISTEET ${points}`],
    };
  },
  slalom(rng) {
    const time = round(28 + rng() * 12, 2);
    const hits = Math.floor(rng() * 3);
    const missed = Math.floor(rng() * 3);
    const valid = missed < 2;
    const points = valid ? slalomPoints({ time, hits, missed }) : 0;
    return {
      valid,
      points,
      time,
      summary: [
        `AIKA ${formatTime(time)}`,
        `OSUMAT ${hits}`,
        `OHITETUT KEPIT ${missed}`,
        valid ? `PISTEET ${points}` : 'HYLÄTTY',
      ],
    };
  },
  luge(rng) {
    const time = round(28 + rng() * 10, 2);
    const crashed = rng() < 0.2;
    const points = crashed ? 0 : lugePoints(time);
    return {
      valid: !crashed,
      points,
      time,
      summary: crashed ? ['SUISTUIT RADALTA', 'HYLÄTTY'] : [`AIKA ${formatTime(time)}`, `PISTEET ${points}`],
    };
  },
};

export class PlaceholderEventScene {
  constructor({ game, eventId, name, onComplete, rng = Math.random }) {
    this.game = game;
    this.eventId = eventId;
    this.name = name;
    this.onComplete = onComplete;
    this.rng = rng;
    this.done = false;
    this.time = 0;
    this.snow = new Snowfall();
  }

  update(dt, input) {
    this.time += dt;
    this.snow.update(dt);
    if (this.done || !input.wasPressed('Space')) return;
    this.done = true;
    const attempt = SIMULATORS[this.eventId](this.rng);
    this.game.audio.playSfx(attempt.valid ? 'finish' : 'crash');
    this.onComplete(attempt);
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawPanel(ctx, 40, 70, 240, 100);
    drawText(ctx, this.name, 160, 84, { align: 'center', scale: 2, color: PALETTE.yellow });
    drawText(ctx, 'TESTILAJI', 160, 112, { align: 'center', color: PALETTE.skyLight });
    drawBlinking(ctx, 'VÄLILYÖNTI = ARVO TULOS', 160, 140, this.time, { color: PALETTE.white });
  }
}
```

`game/events/registry.js`:

```js
import { PlaceholderEventScene } from './placeholderEvent.js';

function placeholder(id, name) {
  return (options) => new PlaceholderEventScene({ ...options, eventId: id, name });
}

export const EVENTS = {
  skiJump: {
    id: 'skiJump',
    name: 'MÄKIHYPPY',
    instructions: ['VÄLILYÖNTI = LÄHTÖ, PONNISTUS', 'JA ALASTULO', 'NUOLET = LENTOASENTO'],
    createScene: placeholder('skiJump', 'MÄKIHYPPY'),
  },
  slalom: {
    id: 'slalom',
    name: 'PUJOTTELU',
    instructions: ['VÄLILYÖNTI = LÄHTÖ JA VAUHTI', 'NUOLET = KÄÄNTYMINEN'],
    createScene: placeholder('slalom', 'PUJOTTELU'),
  },
  luge: {
    id: 'luge',
    name: 'OHJASKELKKAILU',
    instructions: ['VÄLILYÖNTI = LÄHTÖ JA TYÖNTÖ', 'NUOLET = OHJAUS', 'NUOLI ALAS = JARRU'],
    createScene: placeholder('luge', 'OHJASKELKKAILU'),
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add game/events tests/events
git commit -m "feat: add event registry with placeholder events" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Scenes, game flow and browser bootstrap

**Files:**
- Create: `game/scenes/infoScene.js`, `game/scenes/titleScene.js`, `game/scenes/nicknameScene.js`, `game/scenes/practiceSelectScene.js`, `game/scenes/pauseScene.js`, `game/scenes/finalScene.js`, `game/flow.js`, `game/main.js`
- Modify: `game/index.html` (replace the temporary page)
- Test: `tests/flow.test.js`

**Interfaces:**
- Consumes: everything from Tasks 5–9.
- Produces:
  - `createFlow(game): { toTitle(), handleGlobalKeys(input): boolean }`
  - Scenes (all `{ update(dt, input), render(ctx), enter?() }`):
    - `InfoScene({ game, title, lines, prompt = 'VÄLILYÖNTI = JATKA', onContinue })`
    - `TitleScene({ game, onCompetition, onPractice })`
    - `NicknameScene({ game, onConfirm(nickname), onBack })`
    - `PracticeSelectScene({ game, onSelect(eventId), onBack })`
    - `PauseScene({ game, onResume, onQuit })`
    - `FinalScene({ game, competition, onDone })`

- [ ] **Step 1: Write the failing flow test**

`tests/flow.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SceneManager } from '../game/engine/sceneManager.js';
import { createFlow } from '../game/flow.js';
import { fakeInput } from './helpers/fakeInput.js';

function fakeGame() {
  const saved = [];
  return {
    saved,
    scenes: new SceneManager(),
    audio: { muted: false, playSfx() {}, playSong() {}, stopSong() {}, toggleMuted() { this.muted = !this.muted; } },
    repository: {
      getNicknames: async () => ['AKU'],
      saveResult: async (payload) => { saved.push(payload); return { saved: true, committed: true, pushed: true }; },
    },
  };
}

const tick = (game, codes = []) => game.scenes.update(1 / 60, fakeInput(codes));
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('a full competition with placeholder events posts one result', async () => {
  const game = fakeGame();
  const flow = createFlow(game);
  flow.toTitle();
  tick(game, ['Space']);                 // KILPAILU
  await flush();                         // nickname list loads
  tick(game, ['Space']);                 // pick AKU
  for (let event = 0; event < 3; event++) {
    tick(game, ['Space']);               // event intro
    for (let attempt = 0; attempt < 3; attempt++) {
      tick(game, ['Space']);             // placeholder attempt
      tick(game, ['Space']);             // attempt result
    }
    tick(game, ['Space']);               // event summary
  }
  await flush();                         // final scene saves
  assert.equal(game.saved.length, 1);
  assert.equal(game.saved[0].nickname, 'AKU');
  assert.deepEqual(Object.keys(game.saved[0].events), ['skiJump', 'slalom', 'luge']);
  tick(game, ['Space']);                 // back to title
  assert.equal(game.scenes.current.constructor.name, 'TitleScene');
});

test('escape opens the pause menu in an event and LOPETA returns to title', () => {
  const game = fakeGame();
  const flow = createFlow(game);
  flow.toTitle();
  tick(game, ['ArrowDown']);
  tick(game, ['Space']);                 // HARJOITTELU
  tick(game, ['Space']);                 // MÄKIHYPPY
  tick(game, ['Space']);                 // practice intro
  assert.equal(game.scenes.current.constructor.name, 'PlaceholderEventScene');
  assert.equal(flow.handleGlobalKeys(fakeInput(['Escape'])), true);
  assert.equal(game.scenes.current.constructor.name, 'PauseScene');
  tick(game, ['ArrowDown']);
  tick(game, ['ArrowDown']);
  tick(game, ['Space']);                 // LOPETA
  assert.equal(game.scenes.current.constructor.name, 'PracticeSelectScene');
});

test('escape is ignored on scenes without a pause target', () => {
  const game = fakeGame();
  const flow = createFlow(game);
  flow.toTitle();
  assert.equal(flow.handleGlobalKeys(fakeInput(['Escape'])), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../game/flow.js'`.

- [ ] **Step 3: Implement scenes**

`game/scenes/infoScene.js`:

```js
import { drawBlinking, drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';

export class InfoScene {
  constructor({ game, title, lines, prompt = 'VÄLILYÖNTI = JATKA', onContinue }) {
    this.game = game;
    this.title = title;
    this.lines = lines;
    this.prompt = prompt;
    this.onContinue = onContinue;
    this.time = 0;
    this.snow = new Snowfall();
  }

  update(dt, input) {
    this.time += dt;
    this.snow.update(dt);
    if (input.wasPressed('Space') || input.wasPressed('Enter')) {
      this.game.audio.playSfx('confirm');
      this.onContinue();
    }
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawPanel(ctx, 30, 36, 260, 180);
    drawText(ctx, this.title, 160, 48, { align: 'center', scale: 2, color: PALETTE.yellow, shadow: PALETTE.darkRed });
    this.lines.forEach((line, index) => {
      drawText(ctx, line, 160, 78 + index * 12, { align: 'center', color: PALETTE.white });
    });
    drawBlinking(ctx, this.prompt, 160, 200, this.time, { color: PALETTE.skyLight });
  }
}
```

`game/scenes/titleScene.js`:

```js
import { TITLE_THEME } from '../audio/songs.js';
import { drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { Menu } from '../ui/menu.js';

export class TitleScene {
  constructor({ game, onCompetition, onPractice }) {
    this.game = game;
    this.snow = new Snowfall(90);
    this.menu = new Menu(
      [{ label: 'KILPAILU', value: onCompetition }, { label: 'HARJOITTELU', value: onPractice }],
      { onMove: () => game.audio.playSfx('select') },
    );
  }

  enter() {
    this.game.audio.playSong(TITLE_THEME);
  }

  update(dt, input) {
    this.snow.update(dt);
    const item = this.menu.update(input);
    if (item) {
      this.game.audio.playSfx('confirm');
      item.value();
    }
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawText(ctx, 'WINTER', 160, 30, { align: 'center', scale: 4, color: PALETTE.yellow, shadow: PALETTE.darkRed });
    drawText(ctx, 'GAMES', 160, 64, { align: 'center', scale: 4, color: PALETTE.yellow, shadow: PALETTE.darkRed });
    drawText(ctx, 'TALVIKISAT', 160, 100, { align: 'center', color: PALETTE.white, shadow: PALETTE.navy });
    drawPanel(ctx, 90, 124, 140, 44);
    this.menu.render(ctx, 160, 134, { lineHeight: 14 });
    drawText(ctx, 'NUOLET + VÄLILYÖNTI', 160, 236, { align: 'center', color: PALETTE.navy });
  }
}
```

`game/scenes/nicknameScene.js`:

```js
import { drawBlinking, drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { NicknameEntry } from '../core/nicknameEntry.js';
import { Menu } from '../ui/menu.js';

const NEW_PLAYER = Symbol('newPlayer');

export class NicknameScene {
  constructor({ game, onConfirm, onBack }) {
    this.game = game;
    this.onConfirm = onConfirm;
    this.onBack = onBack;
    this.state = 'loading';
    this.message = '';
    this.entry = new NicknameEntry();
    this.menu = null;
    this.time = 0;
    this.snow = new Snowfall();
  }

  enter() {
    this.game.repository.getNicknames()
      .then((names) => this.showList(names))
      .catch(() => {
        this.message = 'PALVELIN EI VASTAA';
        this.state = 'entry';
      });
  }

  showList(names) {
    if (this.state !== 'loading') return;
    if (names.length === 0) {
      this.state = 'entry';
      return;
    }
    this.menu = new Menu(
      [...names.map((name) => ({ label: name, value: name })), { label: 'UUSI PELAAJA', value: NEW_PLAYER }],
      { onMove: () => this.game.audio.playSfx('select') },
    );
    this.state = 'list';
  }

  update(dt, input) {
    this.time += dt;
    this.snow.update(dt);
    const typed = input.takeTyped();
    if (input.wasPressed('Escape')) {
      this.game.audio.playSfx('back');
      this.onBack();
      return;
    }
    if (this.state === 'list') this.updateList(input);
    else if (this.state === 'entry') this.updateEntry(input, typed);
  }

  updateList(input) {
    const item = this.menu.update(input);
    if (!item) return;
    if (item.value === NEW_PLAYER) {
      this.game.audio.playSfx('confirm');
      this.state = 'entry';
    } else {
      this.confirm(item.value);
    }
  }

  updateEntry(input, typed) {
    for (const char of typed) {
      if (this.entry.append(char)) this.game.audio.playSfx('tick');
    }
    if (input.wasPressed('Backspace')) this.entry.backspace();
    if (input.wasPressed('Enter') && this.entry.isValid) this.confirm(this.entry.value);
  }

  confirm(nickname) {
    this.game.audio.playSfx('confirm');
    this.onConfirm(nickname);
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawPanel(ctx, 50, 30, 220, 190);
    drawText(ctx, 'PELAAJA', 160, 42, { align: 'center', scale: 2, color: PALETTE.yellow });
    if (this.state === 'loading') {
      drawText(ctx, 'LADATAAN...', 160, 110, { align: 'center', color: PALETTE.white });
    } else if (this.state === 'list') {
      drawText(ctx, 'VALITSE NIMI', 160, 66, { align: 'center', color: PALETTE.skyLight });
      this.menu.render(ctx, 160, 84, { lineHeight: 12, maxVisible: 9 });
    } else {
      drawText(ctx, 'KIRJOITA NIMI (MAX 10)', 160, 70, { align: 'center', color: PALETTE.skyLight });
      drawPanel(ctx, 90, 92, 140, 24);
      drawText(ctx, this.entry.value, 160, 100, { align: 'center', color: PALETTE.white });
      drawBlinking(ctx, '_', 160 + this.entry.value.length * 3 + 4, 101, this.time, { color: PALETTE.yellow });
      drawText(ctx, 'ENTER = OK', 160, 132, { align: 'center', color: PALETTE.white });
      if (this.message) drawText(ctx, this.message, 160, 150, { align: 'center', color: PALETTE.red });
    }
    drawText(ctx, 'ESC = TAKAISIN', 160, 206, { align: 'center', color: PALETTE.grey });
  }
}
```

`game/scenes/practiceSelectScene.js`:

```js
import { drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { EVENT_IDS } from '../core/rules.js';
import { EVENTS } from '../events/registry.js';
import { Menu } from '../ui/menu.js';

const BACK = Symbol('back');

export class PracticeSelectScene {
  constructor({ game, onSelect, onBack }) {
    this.game = game;
    this.onSelect = onSelect;
    this.onBack = onBack;
    this.snow = new Snowfall();
    this.menu = new Menu(
      [...EVENT_IDS.map((eventId) => ({ label: EVENTS[eventId].name, value: eventId })), { label: 'TAKAISIN', value: BACK }],
      { onMove: () => game.audio.playSfx('select') },
    );
  }

  update(dt, input) {
    this.snow.update(dt);
    if (input.wasPressed('Escape')) {
      this.game.audio.playSfx('back');
      this.onBack();
      return;
    }
    const item = this.menu.update(input);
    if (!item) return;
    if (item.value === BACK) {
      this.game.audio.playSfx('back');
      this.onBack();
    } else {
      this.game.audio.playSfx('confirm');
      this.onSelect(item.value);
    }
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawPanel(ctx, 60, 50, 200, 120);
    drawText(ctx, 'HARJOITTELU', 160, 62, { align: 'center', scale: 2, color: PALETTE.yellow });
    this.menu.render(ctx, 160, 96, { lineHeight: 14 });
  }
}
```

`game/scenes/pauseScene.js`:

```js
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/constants.js';
import { drawPanel } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { Menu } from '../ui/menu.js';

export class PauseScene {
  constructor({ game, onResume, onQuit }) {
    this.game = game;
    this.onResume = onResume;
    this.onQuit = onQuit;
    this.menu = new Menu(
      [
        { label: 'JATKA', value: 'resume' },
        { label: () => (game.audio.muted ? 'ÄÄNET: POIS' : 'ÄÄNET: PÄÄLLÄ'), value: 'mute' },
        { label: 'LOPETA', value: 'quit' },
      ],
      { onMove: () => game.audio.playSfx('select') },
    );
  }

  update(dt, input) {
    if (input.wasPressed('Escape')) {
      this.onResume();
      return;
    }
    const item = this.menu.update(input);
    if (!item) return;
    this.game.audio.playSfx('confirm');
    if (item.value === 'resume') this.onResume();
    else if (item.value === 'mute') this.game.audio.toggleMuted();
    else this.onQuit();
  }

  render(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    drawPanel(ctx, 90, 80, 140, 90);
    drawText(ctx, 'TAUKO', 160, 92, { align: 'center', scale: 2, color: PALETTE.yellow });
    this.menu.render(ctx, 160, 118, { lineHeight: 14 });
  }
}
```

`game/scenes/finalScene.js`:

```js
import { drawBlinking, drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { EVENTS } from '../events/registry.js';

const STATUS_TEXT = {
  saving: 'TALLENNETAAN...',
  published: 'TULOS TALLENNETTU JA JULKAISTU',
  saved: 'TULOS TALLENNETTU (EI JULKAISTU)',
  failed: 'TALLENNUS EPÄONNISTUI',
};

export class FinalScene {
  constructor({ game, competition, onDone }) {
    this.game = game;
    this.competition = competition;
    this.onDone = onDone;
    this.status = 'saving';
    this.time = 0;
    this.snow = new Snowfall(90);
  }

  enter() {
    this.game.audio.playSfx('finish');
    this.save();
  }

  save() {
    this.status = 'saving';
    this.game.repository.saveResult(this.competition.toPayload())
      .then((response) => { this.status = response.pushed ? 'published' : 'saved'; })
      .catch(() => { this.status = 'failed'; });
  }

  update(dt, input) {
    this.time += dt;
    this.snow.update(dt);
    if (this.status === 'saving') return;
    if (this.status === 'failed' && input.wasPressed('Enter')) {
      this.save();
      return;
    }
    if (input.wasPressed('Space')) {
      this.game.audio.playSfx('confirm');
      this.onDone();
    }
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawPanel(ctx, 30, 20, 260, 210);
    drawText(ctx, 'LOPPUTULOKSET', 160, 32, { align: 'center', scale: 2, color: PALETTE.yellow, shadow: PALETTE.darkRed });
    drawText(ctx, this.competition.nickname, 160, 56, { align: 'center', color: PALETTE.skyLight });
    this.competition.eventIds.forEach((eventId, index) => {
      const y = 78 + index * 14;
      drawText(ctx, EVENTS[eventId].name, 50, y, { color: PALETTE.white });
      drawText(ctx, String(this.competition.eventResult(eventId).points), 270, y, { align: 'right', color: PALETTE.white });
    });
    ctx.fillStyle = PALETTE.skyLight;
    ctx.fillRect(50, 122, 220, 1);
    drawText(ctx, 'YHTEENSÄ', 50, 132, { scale: 2, color: PALETTE.yellow });
    drawText(ctx, String(this.competition.total), 270, 132, { align: 'right', scale: 2, color: PALETTE.yellow });
    const statusColor = this.status === 'failed' ? PALETTE.red : PALETTE.white;
    drawText(ctx, STATUS_TEXT[this.status], 160, 166, { align: 'center', color: statusColor });
    if (this.status === 'failed') drawText(ctx, 'ENTER = YRITÄ UUDELLEEN', 160, 180, { align: 'center', color: PALETTE.white });
    if (this.status !== 'saving') drawBlinking(ctx, 'VÄLILYÖNTI = VALIKKOON', 160, 210, this.time, { color: PALETTE.skyLight });
  }
}
```

- [ ] **Step 4: Implement flow, bootstrap and page**

`game/flow.js`:

```js
import { EVENT_THEME } from './audio/songs.js';
import { Competition } from './core/competition.js';
import { describeEventResult } from './core/format.js';
import { ATTEMPTS_PER_EVENT } from './core/rules.js';
import { EVENTS } from './events/registry.js';
import { FinalScene } from './scenes/finalScene.js';
import { InfoScene } from './scenes/infoScene.js';
import { NicknameScene } from './scenes/nicknameScene.js';
import { PauseScene } from './scenes/pauseScene.js';
import { PracticeSelectScene } from './scenes/practiceSelectScene.js';
import { TitleScene } from './scenes/titleScene.js';

export function createFlow(game) {
  const { scenes } = game;

  function toTitle() {
    scenes.replace(new TitleScene({ game, onCompetition: toNickname, onPractice: toPracticeSelect }));
  }

  function toNickname() {
    scenes.replace(new NicknameScene({ game, onConfirm: startCompetition, onBack: toTitle }));
  }

  function toPracticeSelect() {
    scenes.replace(new PracticeSelectScene({ game, onSelect: startPractice, onBack: toTitle }));
  }

  function startCompetition(nickname) {
    showCompetitionIntro(new Competition(nickname));
  }

  function showCompetitionIntro(competition) {
    const event = EVENTS[competition.currentEventId];
    game.audio.playSong(EVENT_THEME);
    scenes.replace(new InfoScene({
      game,
      title: event.name,
      lines: [
        `LAJI ${competition.eventIndex + 1}/${competition.eventIds.length}`,
        `PELAAJA ${competition.nickname}`,
        '',
        ...event.instructions,
      ],
      onContinue: () => runCompetitionAttempt(competition),
    }));
  }

  function runCompetitionAttempt(competition) {
    const event = EVENTS[competition.currentEventId];
    const { attemptNumber } = competition;
    const scene = event.createScene({
      game,
      mode: 'competition',
      attemptNumber,
      onComplete: (attempt) => {
        competition.recordAttempt(attempt);
        scenes.replace(new InfoScene({
          game,
          title: `YRITYS ${attemptNumber}/${ATTEMPTS_PER_EVENT}`,
          lines: attempt.summary,
          onContinue: () => (competition.isEventComplete()
            ? showEventSummary(competition)
            : runCompetitionAttempt(competition)),
        }));
      },
    });
    scene.onPauseQuit = toTitle;
    scenes.replace(scene);
  }

  function showEventSummary(competition) {
    const eventId = competition.currentEventId;
    const result = competition.eventResult(eventId);
    scenes.replace(new InfoScene({
      game,
      title: EVENTS[eventId].name,
      lines: [
        'PARAS SUORITUS',
        describeEventResult(eventId, result),
        `PISTEET ${result.points}`,
        '',
        `KOKONAISPISTEET ${competition.total}`,
      ],
      onContinue: () => {
        competition.advance();
        if (competition.isFinished) toFinal(competition);
        else showCompetitionIntro(competition);
      },
    }));
  }

  function toFinal(competition) {
    scenes.replace(new FinalScene({ game, competition, onDone: toTitle }));
  }

  function startPractice(eventId) {
    const event = EVENTS[eventId];
    game.audio.playSong(EVENT_THEME);
    const intro = new InfoScene({
      game,
      title: event.name,
      lines: ['HARJOITTELU', 'ESC = LOPETA', '', ...event.instructions],
      onContinue: () => runPracticeAttempt(eventId, 1),
    });
    intro.onPauseQuit = toPracticeSelect;
    scenes.replace(intro);
  }

  function runPracticeAttempt(eventId, attemptNumber) {
    const scene = EVENTS[eventId].createScene({
      game,
      mode: 'practice',
      attemptNumber,
      onComplete: (attempt) => {
        const result = new InfoScene({
          game,
          title: `HARJOITUS ${attemptNumber}`,
          lines: attempt.summary,
          onContinue: () => runPracticeAttempt(eventId, attemptNumber + 1),
        });
        result.onPauseQuit = toPracticeSelect;
        scenes.replace(result);
      },
    });
    scene.onPauseQuit = toPracticeSelect;
    scenes.replace(scene);
  }

  // Returns true when the key was consumed and the current scene must not update this tick.
  function handleGlobalKeys(input) {
    const paused = scenes.current;
    if (!input.wasPressed('Escape') || !paused?.onPauseQuit) return false;
    scenes.push(new PauseScene({
      game,
      onResume: () => scenes.pop(),
      onQuit: () => paused.onPauseQuit(),
    }));
    return true;
  }

  return { toTitle, handleGlobalKeys };
}
```

`game/main.js`:

```js
import { AudioEngine } from './audio/audioEngine.js';
import { HttpScoreRepository } from './core/scoreRepository.js';
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

const ctx = createScreen(document.getElementById('screen'));
const input = new Input(window);
const audio = new AudioEngine(safeLocalStorage());
window.addEventListener('keydown', () => audio.unlock());

const game = { scenes: new SceneManager(), input, audio, repository: new HttpScoreRepository() };
const flow = createFlow(game);
flow.toTitle();

startLoop({
  step: FIXED_STEP,
  update(dt) {
    if (!flow.handleGlobalKeys(input)) game.scenes.update(dt, input);
    input.endFrame();
  },
  render() {
    game.scenes.render(ctx);
  },
});
```

`game/index.html`:

```html
<!doctype html>
<html lang="fi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Winter Games</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; }
    body { display: flex; align-items: center; justify-content: center; overflow: hidden; }
    canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
  </style>
</head>
<body>
  <canvas id="screen" width="320" height="256"></canvas>
  <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS (including `tests/flow.test.js`).

- [ ] **Step 6: Commit**

```bash
git add game tests/flow.test.js
git commit -m "feat: add menus, competition and practice flow, pause and final scenes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Manual verification in the browser**

No remote exists yet, so the server's `git push` fails harmlessly and the final screen shows `TULOS TALLENNETTU (EI JULKAISTU)`. The local `results:` commit it creates is undone at the end of this step.

Run in background: `npm start`, open `http://127.0.0.1:8080`. Check:
1. Title screen: WINTER GAMES, snowfall, title music starts after first key press.
2. KILPAILU → type a new nickname (e.g. `TESTI`), Enter.
3. Each event: intro → 3 placeholder attempts → summary with best result → next event.
4. Final screen shows points per event and total, status `TULOS TALLENNETTU (EI JULKAISTU)`.
5. `git log -1 --oneline` shows `results: TESTI <total>`; `docs/leaderboard.json` contains TESTI.
6. HARJOITTELU → event → Esc opens TAUKO; ÄÄNET toggles mute (persists after reload); LOPETA returns to practice select.
7. Window resize keeps integer scaling and crisp pixels.

Then stop the server and undo the test result: run `git log -1 --oneline`; if and only if it shows `results: TESTI …`, run `git reset --hard HEAD~1`. All Task 10 code was committed in Step 6, so this only drops the test result.

---

### Task 11: GitHub Pages leaderboard page

**Files:**
- Create: `docs/index.html`, `docs/style.css`, `docs/main.js`, `docs/leaderboard-view.js`, `docs/.nojekyll`
- Test: `tests/docs/leaderboard-view.test.js`

**Interfaces:**
- Consumes: `Board` JSON shape (Task 2) — the page must not import from `game/` (only `docs/` is published).
- Produces: `renderLeaderboard(board): string`, `escapeHtml(value): string`, `formatMetric(eventId, value): string`, `formatDate(iso): string`.

- [ ] **Step 1: Write the failing test**

`tests/docs/leaderboard-view.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, formatDate, formatMetric, renderLeaderboard } from '../../docs/leaderboard-view.js';

const BOARD = {
  version: 1,
  users: {},
  top: [{ nickname: 'JOUNI', total: 150 }, { nickname: 'AKU', total: 120 }],
  eventRecords: {
    skiJump: { nickname: 'JOUNI', points: 76, distance: 198.5, date: '2026-10-06T12:00:00.000Z' },
    luge: { nickname: 'AKU', points: 60, time: 29.87, date: '2026-10-06T12:00:00.000Z' },
  },
  recent: [{
    nickname: 'JOUNI',
    date: '2026-10-06T12:00:00.000Z',
    total: 150,
    events: { skiJump: { points: 76, distance: 198.5 }, slalom: { points: 30, time: 35.2 }, luge: { points: 44, time: 33.1 } },
  }],
};

test('escapeHtml escapes markup characters', () => {
  assert.equal(escapeHtml('<b>"A" & \'B\'</b>'), '&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;');
});

test('formatMetric formats distance and time with Finnish decimals', () => {
  assert.equal(formatMetric('skiJump', 198.5), '198,5 m');
  assert.equal(formatMetric('slalom', 29.871), '29,87 s');
  assert.equal(formatMetric('luge', null), '-');
});

test('formatDate gives d.m.yyyy', () => {
  assert.equal(formatDate('2026-10-06T12:00:00.000Z'), '6.10.2026');
});

test('renderLeaderboard lists top totals in order', () => {
  const html = renderLeaderboard(BOARD);
  assert.ok(html.indexOf('JOUNI') < html.indexOf('AKU'));
  assert.match(html, /150/);
});

test('renderLeaderboard shows event records and a dash for missing ones', () => {
  const html = renderLeaderboard(BOARD);
  assert.match(html, /MÄKIHYPPY[\s\S]*JOUNI[\s\S]*198,5 m/);
  assert.match(html, /PUJOTTELU<\/td><td>-<\/td>/);
});

test('renderLeaderboard shows an empty message when there are no results', () => {
  const html = renderLeaderboard({ version: 1, users: {}, top: [], eventRecords: {}, recent: [] });
  assert.match(html, /EI VIELÄ TULOKSIA/);
});

test('renderLeaderboard escapes nicknames', () => {
  const html = renderLeaderboard({ ...BOARD, top: [{ nickname: '<X>', total: 1 }] });
  assert.ok(!html.includes('<X>'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '.../docs/leaderboard-view.js'`.

- [ ] **Step 3: Implement**

`docs/leaderboard-view.js`:

```js
const EVENTS = [
  ['skiJump', 'MÄKIHYPPY'],
  ['slalom', 'PUJOTTELU'],
  ['luge', 'OHJASKELKKAILU'],
];
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function formatMetric(eventId, value) {
  if (value === null || value === undefined) return '-';
  return eventId === 'skiJump'
    ? `${value.toFixed(1).replace('.', ',')} m`
    : `${value.toFixed(2).replace('.', ',')} s`;
}

export function formatDate(iso) {
  const date = new Date(iso);
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function metricOf(eventId, entry) {
  return eventId === 'skiJump' ? entry.distance : entry.time;
}

function renderTop(top) {
  if (top.length === 0) return '<p class="empty">EI VIELÄ TULOKSIA</p>';
  const rows = top.map((entry, index) => (
    `<tr><td class="rank">${index + 1}.</td><td>${escapeHtml(entry.nickname)}</td><td class="num">${entry.total}</td></tr>`
  ));
  return `<table class="top">${rows.join('')}</table>`;
}

function renderRecords(records) {
  const rows = EVENTS.map(([eventId, name]) => {
    const record = records[eventId];
    if (!record) return `<tr><td>${name}</td><td>-</td><td></td><td></td></tr>`;
    return `<tr><td>${name}</td><td>${escapeHtml(record.nickname)}</td>`
      + `<td class="num">${formatMetric(eventId, metricOf(eventId, record))}</td>`
      + `<td class="num">${record.points} p</td></tr>`;
  });
  return `<table>${rows.join('')}</table>`;
}

function renderRecent(recent) {
  if (recent.length === 0) return '<p class="empty">EI VIELÄ KILPAILUJA</p>';
  const header = '<tr><th>PVM</th><th>PELAAJA</th><th>MÄKI</th><th>PUJO</th><th>KELKKA</th><th>YHT</th></tr>';
  const rows = recent.map((entry) => (
    `<tr><td>${formatDate(entry.date)}</td><td>${escapeHtml(entry.nickname)}</td>`
    + EVENTS.map(([eventId]) => `<td class="num">${entry.events[eventId].points}</td>`).join('')
    + `<td class="num">${entry.total}</td></tr>`
  ));
  return `<table>${header}${rows.join('')}</table>`;
}

export function renderLeaderboard(board) {
  return [
    `<section><h2>PARHAAT YHTEISPISTEET</h2>${renderTop(board.top ?? [])}</section>`,
    `<section><h2>LAJIENNÄTYKSET</h2>${renderRecords(board.eventRecords ?? {})}</section>`,
    `<section><h2>VIIMEISIMMÄT KILPAILUT</h2>${renderRecent(board.recent ?? [])}</section>`,
  ].join('');
}
```

`docs/main.js`:

```js
import { renderLeaderboard } from './leaderboard-view.js';

const root = document.getElementById('leaderboard');

fetch('leaderboard.json', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((board) => { root.innerHTML = renderLeaderboard(board); })
  .catch(() => { root.innerHTML = '<p class="empty">TULOKSIA EI VOITU LADATA</p>'; });
```

`docs/index.html`:

```html
<!doctype html>
<html lang="fi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Winter Games – tulokset</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>WINTER GAMES</h1>
    <p class="subtitle">TALVIKISAT – TULOSTAULU</p>
  </header>
  <main id="leaderboard"><p class="empty">LADATAAN...</p></main>
  <script type="module" src="main.js"></script>
</body>
</html>
```

`docs/style.css`:

```css
:root {
  --night: #101028;
  --navy: #202060;
  --sky-light: #a0c8f0;
  --white: #ffffff;
  --yellow: #f0e040;
  --dark-red: #801010;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 24px 16px;
  min-height: 100vh;
  background: linear-gradient(var(--night), var(--navy));
  color: var(--white);
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  line-height: 1.8;
}

header, main { max-width: 760px; margin: 0 auto; }

h1 {
  margin: 0;
  color: var(--yellow);
  font-size: clamp(20px, 6vw, 40px);
  text-align: center;
  text-shadow: 4px 4px 0 var(--dark-red);
}

.subtitle { text-align: center; color: var(--sky-light); }

section {
  margin-top: 24px;
  padding: 16px;
  border: 2px solid var(--sky-light);
  background: var(--night);
  overflow-x: auto;
}

h2 { margin: 0 0 12px; font-size: 13px; color: var(--yellow); }

table { width: 100%; border-collapse: collapse; }
th { color: var(--sky-light); text-align: left; font-weight: normal; }
th, td { padding: 4px 8px 4px 0; white-space: nowrap; }
.num { text-align: right; }
.rank { width: 3em; color: var(--sky-light); }
.empty { color: var(--sky-light); }
```

`docs/.nojekyll`: empty file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Manual check**

Run `python -m http.server 8090 --directory docs` in background (Python's built-in server; no installs) and open `http://127.0.0.1:8090`. Expected: page renders with "EI VIELÄ TULOKSIA". Stop the server.

- [ ] **Step 6: Commit**

```bash
git add docs/index.html docs/style.css docs/main.js docs/leaderboard-view.js docs/.nojekyll tests/docs
git commit -m "feat: add GitHub Pages leaderboard page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Publish repository and enable GitHub Pages (requires user approval)

**Files:** none (remote setup)

- [ ] **Step 1: Ask the user for approval**

Ask: "Luodaanko julkinen GitHub-repo `JouniJokelainen/winter-games`, pushataan `main` ja otetaan Pages käyttöön `docs/`-kansiosta?" Do not continue without an explicit yes.

- [ ] **Step 2: Create repo and push**

```bash
gh repo create JouniJokelainen/winter-games --public --source . --remote origin --push
```

Expected: repo URL printed, `git status -sb` shows `## main...origin/main`.

- [ ] **Step 3: Enable Pages from `main` / `docs`**

```bash
gh api -X POST repos/JouniJokelainen/winter-games/pages -f "source[branch]=main" -f "source[path]=/docs"
gh api repos/JouniJokelainen/winter-games/pages --jq .html_url
```

Expected: `https://jounijokelainen.github.io/winter-games/`.

- [ ] **Step 4: End-to-end check**

1. `npm start`, play one full competition (placeholder events) with nickname `TESTI`.
2. Final screen shows `TULOS TALLENNETTU JA JULKAISTU`.
3. `git log origin/main -1 --oneline` shows `results: TESTI <total>`.
4. After 1–2 minutes the Pages URL shows TESTI in all three sections.
5. Ask the user whether to keep or remove the TESTI result. If removing: edit `docs/leaderboard.json` back to the empty board, then `git commit -m "chore: clear test results" -- docs/leaderboard.json` and `git push`.

---

## Follow-up plans (not part of this plan)

Each replaces one placeholder in `game/events/registry.js` with a real scene that follows the event scene contract:

1. `plans/YYYY-MM-DD-ski-jump.md` — side view, parallax spectators, wind flag, takeoff/flight/landing physics tuned so 200 m needs strong wind + near-perfect play.
2. `plans/YYYY-MM-DD-slalom.md` — front view, fixed 20-pole course tuned to 30 s, steering by ski angle, hits/missed poles.
3. `plans/YYYY-MM-DD-luge.md` — pseudo-3D rear view track, 5 s push phase, red line timing start, curve speed limits, inner/middle/outer line speed effects.
