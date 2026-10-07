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
