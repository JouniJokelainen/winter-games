import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../engine/constants.js';
import { drawPanel } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { Menu } from '../ui/menu.js';

export class PauseScene {
  constructor({ game, onResume, onQuit }) {
    this.game = game;
    this.highResolution = true;
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
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawPanel(ctx, 180, 160, 280, 180);
    drawText(ctx, 'TAUKO', 320, 184, { align: 'center', scale: 4, color: PALETTE.red });
    this.menu.render(ctx, 320, 236, { lineHeight: 28, scale: 2 });
  }
}
