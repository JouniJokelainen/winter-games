import { TITLE_THEME } from '../audio/songs.js';
import { drawPanel } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { drawVenueBackdrop } from '../engine/scenery.js';
import { Menu } from '../ui/menu.js';

const TOP_COUNT = 3;

export class TitleScene {
  constructor({ game, onCompetition, onPractice }) {
    this.game = game;
    this.highResolution = true;
    this.time = 0;
    this.top = [];
    this.menu = new Menu(
      [{ label: 'KILPAILU', value: onCompetition }, { label: 'HARJOITTELU', value: onPractice }],
      { onMove: () => game.audio.playSfx('select') },
    );
  }

  enter() {
    this.game.audio.playSong(TITLE_THEME);
    this.loadTop();
  }

  // The best totals are a bonus: without a reachable board the title screen simply shows none.
  loadTop() {
    this.game.repository?.getLeaderboard?.()
      .then((board) => { this.top = (board.top ?? []).slice(0, TOP_COUNT); })
      .catch(() => {});
  }

  update(dt, input) {
    this.time += dt;
    const item = this.menu.update(input);
    if (item) {
      this.game.audio.playSfx('confirm');
      item.value();
    }
  }

  render(ctx) {
    drawVenueBackdrop(ctx, this.time);
    drawText(ctx, 'WINTER', 320, 60, { align: 'center', scale: 8, color: PALETTE.paper, shadow: PALETTE.slate });
    drawText(ctx, 'GAMES', 320, 128, { align: 'center', scale: 8, color: PALETTE.paper, shadow: PALETTE.slate });
    drawText(ctx, 'TALVIKISAT', 320, 200, { align: 'center', scale: 2, color: PALETTE.red, shadow: PALETTE.slate });
    drawPanel(ctx, 180, 248, 280, 88);
    this.menu.render(ctx, 320, 268, { lineHeight: 28, scale: 2 });
    this.renderTop(ctx);
    drawText(ctx, 'NUOLET + VÄLILYÖNTI', 320, 472, { align: 'center', scale: 2, color: PALETTE.slate });
  }

  renderTop(ctx) {
    if (this.top.length === 0) return;
    drawPanel(ctx, 180, 344, 280, 110);
    drawText(ctx, 'PARHAAT', 320, 354, { align: 'center', scale: 2, color: PALETTE.red, shadow: PALETTE.slate });
    this.top.forEach((entry, index) => {
      const line = `${index + 1}. ${entry.nickname.padEnd(10)} ${String(entry.total).padStart(3)}`;
      drawText(ctx, line, 320, 380 + index * 24, { align: 'center', scale: 2, color: PALETTE.paper, shadow: PALETTE.slate });
    });
  }
}
