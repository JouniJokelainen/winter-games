import { drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { EVENT_IDS } from '../core/rules.js';
import { EVENTS } from '../events/registry.js';
import { Menu } from '../ui/menu.js';

const BACK = Symbol('back');

export class PracticeSelectScene {
  constructor({ game, onSelect, onBack }) {
    this.game = game;
    this.onSelect = onSelect;
    this.onBack = onBack;
    this.snow = new Snowfall();
    this.menu = new Menu(
      [...EVENT_IDS.map((eventId) => ({ label: EVENTS[eventId].name, value: eventId })), { label: 'TAKAISIN', value: BACK }],
      { onMove: () => game.audio.playSfx('select') },
    );
  }

  update(dt, input) {
    this.snow.update(dt);
    if (input.wasPressed('Escape')) {
      this.game.audio.playSfx('back');
      this.onBack();
      return;
    }
    const item = this.menu.update(input);
    if (!item) return;
    if (item.value === BACK) {
      this.game.audio.playSfx('back');
      this.onBack();
    } else {
      this.game.audio.playSfx('confirm');
      this.onSelect(item.value);
    }
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawPanel(ctx, 60, 50, 200, 120);
    drawText(ctx, 'HARJOITTELU', 160, 62, { align: 'center', scale: 2, color: PALETTE.yellow });
    this.menu.render(ctx, 160, 96, { lineHeight: 14 });
  }
}
