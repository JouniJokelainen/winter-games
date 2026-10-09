import { drawBlinking, drawPanel } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { drawVenueBackdrop } from '../engine/venueBackdrop.js';
import { SecretEntry } from '../core/deviceKeys.js';
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
    this.secret = new SecretEntry();
    this.claimed = null; // the nickname whose recovery code is being asked
    this.returnState = 'entry';
    this.menu = null;
    this.time = 0;
    this.highResolution = true;
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
    const typed = input.takeTyped();
    if (input.wasPressed('Escape')) {
      this.game.audio.playSfx('back');
      if (this.state === 'recovery') this.leaveRecovery();
      else this.onBack();
      return;
    }
    if (this.state === 'list') this.updateList(input);
    else if (this.state === 'entry') this.updateEntry(input, typed);
    else if (this.state === 'recovery') this.updateRecovery(input, typed);
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

  // On the shared board a nickname may belong to another device; then its recovery code is asked.
  confirm(nickname) {
    this.game.audio.playSfx('confirm');
    const { repository } = this.game;
    if (!repository.checkNickname) {
      this.onConfirm(nickname);
      return;
    }
    this.returnState = this.state;
    this.state = 'checking';
    repository.checkNickname(nickname)
      .then((status) => {
        if (status === 'taken') this.startRecovery(nickname);
        else this.onConfirm(nickname);
      })
      .catch(() => this.onConfirm(nickname)); // the save reports problems with the board later
  }

  startRecovery(nickname) {
    this.claimed = nickname;
    this.secret = new SecretEntry();
    this.message = '';
    this.state = 'recovery';
  }

  leaveRecovery() {
    this.message = '';
    this.state = this.returnState;
  }

  updateRecovery(input, typed) {
    for (const char of typed) {
      if (this.secret.append(char)) this.game.audio.playSfx('tick');
    }
    if (input.wasPressed('Backspace')) this.secret.backspace();
    if (!input.wasPressed('Enter') || !this.secret.isComplete) return;
    const nickname = this.claimed;
    this.state = 'checking';
    this.game.repository.recoverNickname(nickname, this.secret.value)
      .then((ok) => {
        if (ok) {
          this.onConfirm(nickname);
        } else {
          this.message = 'VÄÄRÄ KOODI';
          this.state = 'recovery';
        }
      })
      .catch(() => {
        this.message = 'PALVELIN EI VASTAA';
        this.state = 'recovery';
      });
  }

  render(ctx) {
    drawVenueBackdrop(ctx, this.time);
    drawPanel(ctx, 100, 60, 440, 380);
    drawText(ctx, 'PELAAJA', 320, 84, { align: 'center', scale: 4, color: PALETTE.red });
    if (this.state === 'loading') {
      drawText(ctx, 'LADATAAN...', 320, 220, { align: 'center', scale: 2, color: PALETTE.paper });
    } else if (this.state === 'list') {
      drawText(ctx, 'VALITSE NIMI', 320, 132, { align: 'center', scale: 2, color: PALETTE.paperDim });
      this.menu.render(ctx, 320, 168, { lineHeight: 24, maxVisible: 9, scale: 2 });
    } else if (this.state === 'checking') {
      drawText(ctx, 'TARKISTETAAN...', 320, 220, { align: 'center', scale: 2, color: PALETTE.paper });
    } else if (this.state === 'recovery') {
      drawText(ctx, `${this.claimed} ON VARATTU`, 320, 132, { align: 'center', scale: 2, color: PALETTE.red });
      drawText(ctx, 'SYÖTÄ PALAUTUSKOODI', 320, 172, { align: 'center', scale: 2, color: PALETTE.paperDim });
      drawPanel(ctx, 140, 204, 360, 48);
      drawText(ctx, this.secret.display, 320, 220, { align: 'center', scale: 2, color: PALETTE.paper });
      drawText(ctx, 'ENTER = OK', 320, 280, { align: 'center', scale: 2, color: PALETTE.paper });
      if (this.message) drawText(ctx, this.message, 320, 316, { align: 'center', scale: 2, color: PALETTE.red });
      drawText(ctx, 'ESC = VALITSE TOINEN NIMI', 320, 360, { align: 'center', scale: 2, color: PALETTE.paperDim });
    } else {
      drawText(ctx, 'KIRJOITA NIMI (MAX 10)', 320, 140, { align: 'center', scale: 2, color: PALETTE.paperDim });
      drawPanel(ctx, 180, 184, 280, 48);
      drawText(ctx, this.entry.value, 320, 200, { align: 'center', scale: 2, color: PALETTE.paper });
      drawBlinking(ctx, '_', 320 + this.entry.value.length * 6 + 8, 202, this.time, { scale: 2, color: PALETTE.red });
      drawText(ctx, 'ENTER = OK', 320, 264, { align: 'center', scale: 2, color: PALETTE.paper });
      if (this.message) drawText(ctx, this.message, 320, 300, { align: 'center', scale: 2, color: PALETTE.red });
    }
    if (this.state !== 'recovery') drawText(ctx, 'ESC = TAKAISIN', 320, 412, { align: 'center', scale: 2, color: PALETTE.paperDim });
  }
}
