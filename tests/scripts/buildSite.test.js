import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIdFromEnv, buildSite, remoteFromEnv, stampText } from '../../scripts/build-site.mjs';

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

test('shared leaderboard settings are written to the site only when given', async (t) => {
  const root = await tempDir(t, 'wg-site-src-');
  await write(root, 'docs/index.html', 'leaderboard');
  await write(root, 'game/index.html', 'game');
  const remote = { url: 'https://example.supabase.co', key: 'sb_publishable_test' };

  const withRemote = await tempDir(t, 'wg-site-out-');
  await buildSite({ repoDir: root, outDir: withRemote, remote });
  for (const file of ['supabase-config.json', 'peli/supabase-config.json']) {
    assert.deepEqual(JSON.parse(await readFile(join(withRemote, file), 'utf8')), remote);
  }

  const without = await tempDir(t, 'wg-site-out-');
  await buildSite({ repoDir: root, outDir: without });
  assert.ok(!(await readdir(without, { recursive: true })).some((file) => file.endsWith('supabase-config.json')));
});

test('remoteFromEnv needs both the URL and the key', () => {
  assert.deepEqual(remoteFromEnv({ SUPABASE_URL: 'u', SUPABASE_PUBLISHABLE_KEY: 'k' }), { url: 'u', key: 'k' });
  assert.equal(remoteFromEnv({ SUPABASE_URL: 'u' }), null);
  assert.equal(remoteFromEnv({}), null);
});

test('stampText adds the build id to module addresses and the page links only', () => {
  const js = "import { a } from './core/a.js';\nimport {\n  b,\n} from '../engine/b.js';\nimport c from 'node:fs';\nconst x = fetch('data.json');";
  assert.equal(
    stampText('main.js', js, 'ID1'),
    "import { a } from './core/a.js?v=ID1';\nimport {\n  b,\n} from '../engine/b.js?v=ID1';\nimport c from 'node:fs';\nconst x = fetch('data.json');",
  );
  const html = '<link rel="stylesheet" href="style.css"><script type="module" src="main.js"></script><a href="peli/">x</a><a href="https://x.test/a.js">y</a>';
  assert.equal(
    stampText('index.html', html, 'ID1'),
    '<link rel="stylesheet" href="style.css?v=ID1"><script type="module" src="main.js?v=ID1"></script><a href="peli/">x</a><a href="https://x.test/a.js">y</a>',
  );
  assert.equal(stampText('data.json', '{"from":"./a.js"}', 'ID1'), '{"from":"./a.js"}');
});

test('a stamped build addresses every module with the id and publishes version.json', async (t) => {
  const outDir = await tempDir(t, 'wg-site-stamped-');
  await buildSite({ repoDir: realRepo, outDir, buildId: 'abc1234567' });
  assert.deepEqual(JSON.parse(await readFile(join(outDir, 'version.json'), 'utf8')), { id: 'abc1234567' });
  assert.deepEqual(JSON.parse(await readFile(join(outDir, 'peli', 'version.json'), 'utf8')), { id: 'abc1234567' });
  assert.match(await readFile(join(outDir, 'peli', 'index.html'), 'utf8'), /src="main\.js\?v=abc1234567"/);
  assert.match(await readFile(join(outDir, 'index.html'), 'utf8'), /src="main\.js\?v=abc1234567"/);
  const unstamped = [];
  for (const relative of await readdir(outDir, { recursive: true })) {
    if (!relative.endsWith('.js')) continue;
    const text = await readFile(join(outDir, relative), 'utf8');
    for (const match of text.matchAll(/\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      if (!match[1].endsWith('?v=abc1234567')) unstamped.push(`${relative}: ${match[1]}`);
    }
  }
  assert.deepEqual(unstamped, []);
});

test('an unstamped build leaves the files as they are', async (t) => {
  const outDir = await tempDir(t, 'wg-site-plain-');
  await buildSite({ repoDir: realRepo, outDir });
  assert.match(await readFile(join(outDir, 'peli', 'index.html'), 'utf8'), /src="main\.js"/);
  assert.ok(!(await readdir(outDir, { recursive: true })).includes('version.json'));
});

test('buildIdFromEnv shortens the commit hash', () => {
  assert.equal(buildIdFromEnv({ GITHUB_SHA: '0123456789abcdef' }), '0123456789');
  assert.equal(buildIdFromEnv({}), null);
});
