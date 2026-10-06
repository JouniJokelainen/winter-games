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
