import { TITLE_THEME } from '../audio/songs.js';
import { drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { Menu } from '../ui/menu.js';

export class TitleScene {
  constructor({ game, onCompetition, onPractice }) {
    this.game = game;
    this.snow = new Snowfall(90);
    this.menu = new Menu(
      [{ label: 'KILPAILU', value: onCompetition }, { label: 'HARJOITTELU', value: onPractice }],
      { onMove: () => game.audio.playSfx('select') },
    );
  }

  enter() {
    this.game.audio.playSong(TITLE_THEME);
  }

  update(dt, input) {
    this.snow.update(dt);
    const item = this.menu.update(input);
    if (item) {
      this.game.audio.playSfx('confirm');
      item.value();
    }
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawText(ctx, 'WINTER', 160, 30, { align: 'center', scale: 4, color: PALETTE.yellow, shadow: PALETTE.darkRed });
    drawText(ctx, 'GAMES', 160, 64, { align: 'center', scale: 4, color: PALETTE.yellow, shadow: PALETTE.darkRed });
    drawText(ctx, 'TALVIKISAT', 160, 100, { align: 'center', color: PALETTE.white, shadow: PALETTE.navy });
    drawPanel(ctx, 90, 124, 140, 44);
    this.menu.render(ctx, 160, 134, { lineHeight: 14 });
    drawText(ctx, 'NUOLET + VÄLILYÖNTI', 160, 236, { align: 'center', color: PALETTE.navy });
  }
}
