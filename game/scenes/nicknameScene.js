import { drawBlinking, drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { NicknameEntry } from '../core/nicknameEntry.js';
import { Menu } from '../ui/menu.js';

const NEW_PLAYER = Symbol('newPlayer');

export class NicknameScene {
  constructor({ game, onConfirm, onBack }) {
    this.game = game;
    this.onConfirm = onConfirm;
    this.onBack = onBack;
    this.state = 'loading';
    this.message = '';
    this.entry = new NicknameEntry();
    this.menu = null;
    this.time = 0;
    this.snow = new Snowfall();
  }

  enter() {
    this.game.repository.getNicknames()
      .then((names) => this.showList(names))
      .catch(() => {
        this.message = 'PALVELIN EI VASTAA';
        this.state = 'entry';
      });
  }

  showList(names) {
    if (this.state !== 'loading') return;
    if (names.length === 0) {
      this.state = 'entry';
      return;
    }
    this.menu = new Menu(
      [...names.map((name) => ({ label: name, value: name })), { label: 'UUSI PELAAJA', value: NEW_PLAYER }],
      { onMove: () => this.game.audio.playSfx('select') },
    );
    this.state = 'list';
  }

  update(dt, input) {
    this.time += dt;
    this.snow.update(dt);
    const typed = input.takeTyped();
    if (input.wasPressed('Escape')) {
      this.game.audio.playSfx('back');
      this.onBack();
      return;
    }
    if (this.state === 'list') this.updateList(input);
    else if (this.state === 'entry') this.updateEntry(input, typed);
  }

  updateList(input) {
    const item = this.menu.update(input);
    if (!item) return;
    if (item.value === NEW_PLAYER) {
      this.game.audio.playSfx('confirm');
      this.state = 'entry';
    } else {
      this.confirm(item.value);
    }
  }

  updateEntry(input, typed) {
    for (const char of typed) {
      if (this.entry.append(char)) this.game.audio.playSfx('tick');
    }
    if (input.wasPressed('Backspace')) this.entry.backspace();
    if (input.wasPressed('Enter') && this.entry.isValid) this.confirm(this.entry.value);
  }

  confirm(nickname) {
    this.game.audio.playSfx('confirm');
    this.onConfirm(nickname);
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawPanel(ctx, 50, 30, 220, 190);
    drawText(ctx, 'PELAAJA', 160, 42, { align: 'center', scale: 2, color: PALETTE.yellow });
    if (this.state === 'loading') {
      drawText(ctx, 'LADATAAN...', 160, 110, { align: 'center', color: PALETTE.white });
    } else if (this.state === 'list') {
      drawText(ctx, 'VALITSE NIMI', 160, 66, { align: 'center', color: PALETTE.skyLight });
      this.menu.render(ctx, 160, 84, { lineHeight: 12, maxVisible: 9 });
    } else {
      drawText(ctx, 'KIRJOITA NIMI (MAX 10)', 160, 70, { align: 'center', color: PALETTE.skyLight });
      drawPanel(ctx, 90, 92, 140, 24);
      drawText(ctx, this.entry.value, 160, 100, { align: 'center', color: PALETTE.white });
      drawBlinking(ctx, '_', 160 + this.entry.value.length * 3 + 4, 101, this.time, { color: PALETTE.yellow });
      drawText(ctx, 'ENTER = OK', 160, 132, { align: 'center', color: PALETTE.white });
      if (this.message) drawText(ctx, this.message, 160, 150, { align: 'center', color: PALETTE.red });
    }
    drawText(ctx, 'ESC = TAKAISIN', 160, 206, { align: 'center', color: PALETTE.grey });
  }
}
