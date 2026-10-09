import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRepoDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const skipDevelopmentResults = (source) => !source.endsWith('.dev.json');

// Module addresses (`from './x.js'`) and the page's own script and style links get `?v=<id>` appended.
const MODULE_SPECIFIER = /(\bfrom\s*)(['"])(\.{1,2}\/[^'"?]+\.js)\2/g;
const PAGE_LINK = /\b(src|href)="([^":/?]+\.(?:js|css))"/g;

export function stampText(file, text, id) {
  if (file.endsWith('.js') || file.endsWith('.mjs')) return text.replace(MODULE_SPECIFIER, `$1$2$3?v=${id}$2`);
  if (file.endsWith('.html')) return text.replace(PAGE_LINK, `$1="$2?v=${id}"`);
  return text;
}

async function stampVersion(outDir, id) {
  for (const relative of await readdir(outDir, { recursive: true })) {
    if (!/\.(m?js|html)$/.test(relative)) continue;
    const file = join(outDir, relative);
    const text = await readFile(file, 'utf8');
    const stamped = stampText(relative, text, id);
    if (stamped !== text) await writeFile(file, stamped);
  }
  const version = JSON.stringify({ id });
  await writeFile(join(outDir, 'version.json'), version);
  await writeFile(join(outDir, 'peli', 'version.json'), version);
}

// Builds the GitHub Pages site: docs/ (the leaderboard) at the root and game/ under peli/.
// Development results (*.dev.json) are never copied. When `remote` ({ url, key }) is given, the shared
// leaderboard settings are written to supabase-config.json in the site root and under peli/; they come
// from the build environment, never from the repository. When `buildId` is given, every file address is
// stamped with it and version.json is written (see game/core/updateCheck.js).
export async function buildSite({
  repoDir = defaultRepoDir, outDir = join(repoDir, '_site'), remote = null, buildId = null,
} = {}) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(join(repoDir, 'docs'), outDir, { recursive: true, filter: skipDevelopmentResults });
  await cp(join(repoDir, 'game'), join(outDir, 'peli'), { recursive: true, filter: skipDevelopmentResults });
  if (remote) {
    const config = JSON.stringify({ url: remote.url, key: remote.key });
    await writeFile(join(outDir, 'supabase-config.json'), config);
    await writeFile(join(outDir, 'peli', 'supabase-config.json'), config);
  }
  if (buildId) await stampVersion(outDir, buildId);
  return outDir;
}

export function buildIdFromEnv(env = process.env) {
  return env.GITHUB_SHA ? env.GITHUB_SHA.slice(0, 10) : null;
}

export function remoteFromEnv(env = process.env) {
  return env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY
    ? { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY }
    : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Site built in ${await buildSite({ remote: remoteFromEnv(), buildId: buildIdFromEnv() })}`);
}
