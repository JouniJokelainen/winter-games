import { drawPanel } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { EVENT_IDS } from '../core/rules.js';
import { EVENTS } from '../events/registry.js';
import { drawVenueBackdrop } from '../engine/scenery.js';
import { Menu } from '../ui/menu.js';

const BACK = Symbol('back');

export class PracticeSelectScene {
  constructor({ game, onSelect, onBack }) {
    this.game = game;
    this.onSelect = onSelect;
    this.onBack = onBack;
    this.highResolution = true;
    this.time = 0;
    this.menu = new Menu(
      [...EVENT_IDS.map((eventId) => ({ label: EVENTS[eventId].name, value: eventId })), { label: 'TAKAISIN', value: BACK }],
      { onMove: () => game.audio.playSfx('select') },
    );
  }

  update(dt, input) {
    this.time += dt;
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
    drawVenueBackdrop(ctx, this.time);
    drawPanel(ctx, 120, 100, 400, 240);
    drawText(ctx, 'HARJOITTELU', 320, 124, { align: 'center', scale: 4, color: PALETTE.red });
    this.menu.render(ctx, 320, 192, { lineHeight: 28, scale: 2 });
  }
}
