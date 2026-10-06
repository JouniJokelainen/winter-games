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
