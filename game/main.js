import { AudioEngine } from './audio/audioEngine.js';
import { chooseScoreRepository, loadRemoteConfig } from './core/scoreRepository.js';
import { buildIdOf, staleRedirect } from './core/updateCheck.js';
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

// A stale build (right after a deploy) reloads through the newest address before anything starts.
const reloadTo = await staleRedirect({
  ownId: buildIdOf(import.meta.url),
  pathname: window.location.pathname,
  search: window.location.search,
});
if (reloadTo) {
  window.location.replace(reloadTo);
  await new Promise(() => {});
}

const storage = safeLocalStorage();
const ctx = createScreen(document.getElementById('screen'));
const input = new Input(window);
const audio = new AudioEngine(storage);
window.addEventListener('keydown', () => audio.unlock());

const repository = await chooseScoreRepository({ storage, remote: await loadRemoteConfig() });
const game = { scenes: new SceneManager(), input, audio, repository };
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
