import { drawBlinking, drawPanel } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { drawVenueBackdrop } from '../engine/venueBackdrop.js';

export class InfoScene {
  constructor({ game, title, lines, prompt = 'VÄLILYÖNTI = JATKA', onContinue, minShowSeconds = 0.6 }) {
    this.game = game;
    this.title = title;
    this.lines = lines;
    this.prompt = prompt;
    this.onContinue = onContinue;
    this.minShowSeconds = minShowSeconds;
    this.time = 0;
    this.highResolution = true;
  }

  update(dt, input) {
    this.time += dt;
    if (this.time < this.minShowSeconds) return;
    if (input.wasPressed('Space') || input.wasPressed('Enter')) {
      this.game.audio.playSfx('confirm');
      this.onContinue();
    }
  }

  render(ctx) {
    drawVenueBackdrop(ctx, this.time);
    drawPanel(ctx, 60, 72, 520, 360);
    drawText(ctx, this.title, 320, 96, { align: 'center', scale: 4, color: PALETTE.red });
    this.lines.forEach((line, index) => {
      drawText(ctx, line, 320, 156 + index * 24, { align: 'center', scale: 2, color: PALETTE.paper });
    });
    drawBlinking(ctx, this.prompt, 320, 400, this.time, { scale: 2, color: PALETTE.paperDim });
  }
}
