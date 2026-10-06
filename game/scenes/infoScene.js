import { drawBlinking, drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';

export class InfoScene {
  constructor({ game, title, lines, prompt = 'VÄLILYÖNTI = JATKA', onContinue, minShowSeconds = 0.6 }) {
    this.game = game;
    this.title = title;
    this.lines = lines;
    this.prompt = prompt;
    this.onContinue = onContinue;
    this.minShowSeconds = minShowSeconds;
    this.time = 0;
    this.snow = new Snowfall();
  }

  update(dt, input) {
    this.time += dt;
    this.snow.update(dt);
    if (this.time < this.minShowSeconds) return;
    if (input.wasPressed('Space') || input.wasPressed('Enter')) {
      this.game.audio.playSfx('confirm');
      this.onContinue();
    }
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawPanel(ctx, 30, 36, 260, 180);
    drawText(ctx, this.title, 160, 48, { align: 'center', scale: 2, color: PALETTE.yellow, shadow: PALETTE.darkRed });
    this.lines.forEach((line, index) => {
      drawText(ctx, line, 160, 78 + index * 12, { align: 'center', color: PALETTE.white });
    });
    drawBlinking(ctx, this.prompt, 160, 200, this.time, { color: PALETTE.skyLight });
  }
}
