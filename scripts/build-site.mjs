import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRepoDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const skipDevelopmentResults = (source) => !source.endsWith('.dev.json');

// Builds the GitHub Pages site: docs/ (the leaderboard) at the root and game/ under peli/.
// Development results (*.dev.json) are never copied. When `remote` ({ url, key }) is given, the shared
// leaderboard settings are written to supabase-config.json in the site root and under peli/; they come
// from the build environment, never from the repository.
export async function buildSite({ repoDir = defaultRepoDir, outDir = join(repoDir, '_site'), remote = null } = {}) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(join(repoDir, 'docs'), outDir, { recursive: true, filter: skipDevelopmentResults });
  await cp(join(repoDir, 'game'), join(outDir, 'peli'), { recursive: true, filter: skipDevelopmentResults });
  if (remote) {
    const config = JSON.stringify({ url: remote.url, key: remote.key });
    await writeFile(join(outDir, 'supabase-config.json'), config);
    await writeFile(join(outDir, 'peli', 'supabase-config.json'), config);
  }
  return outDir;
}

export function remoteFromEnv(env = process.env) {
  return env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY
    ? { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY }
    : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Site built in ${await buildSite({ remote: remoteFromEnv() })}`);
}
