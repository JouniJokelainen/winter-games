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
