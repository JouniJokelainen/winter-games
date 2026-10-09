// GitHub Pages lets browsers keep files for ten minutes, so right after a deploy a player can still run the
// previous build. The Pages build stamps every file address with the build id (`main.js?v=<id>`) and writes
// the newest id to version.json. At start-up the game compares its own id with it and, when it is stale,
// reloads through an address carrying the new id, which the browser cannot have cached.

export function buildIdOf(url) {
  return new URL(url).searchParams.get('v');
}

// The address to reload when this build is stale, or null when the game is current, unstamped (local
// play), the check failed, or the new address has already been tried.
export async function staleRedirect({
  ownId,
  pathname,
  search = '',
  fetchFn = (...args) => globalThis.fetch(...args),
  timeoutMs = 1500,
}) {
  if (!ownId) return null;
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    const response = await Promise.race([fetchFn('version.json', { cache: 'no-store' }), timeout]);
    if (!response.ok) return null;
    const { id } = await response.json();
    if (typeof id !== 'string' || id === '' || id === ownId) return null;
    const target = `?v=${encodeURIComponent(id)}`;
    return search === target ? null : `${pathname}${target}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
