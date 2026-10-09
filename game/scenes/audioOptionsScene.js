import { VOLUME_STEP } from '../audio/audioEngine.js';
import { drawPanel } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { drawVenueBackdrop } from '../engine/venueBackdrop.js';
import { Menu } from '../ui/menu.js';

const percent = (volume) => `${Math.round(volume * 100)}%`;

// Music on/off and the volume of the music and of the sound effects, saved by the audio engine.
export class AudioOptionsScene {
  constructor({ game, onBack }) {
    this.game = game;
    this.onBack = onBack;
    this.highResolution = true;
    this.time = 0;
    const { audio } = game;
    this.rows = [
      {
        label: () => `MUSIIKKI: ${audio.settings.musicOn ? 'PÄÄLLÄ' : 'POIS'}`,
        change: () => audio.setMusicOn(!audio.settings.musicOn),
      },
      {
        label: () => `MUSIIKIN ÄÄNI: ${percent(audio.settings.music)}`,
        change: (direction) => audio.setMusicVolume(audio.settings.music + direction * VOLUME_STEP),
      },
      {
        label: () => `TEHOSTEIDEN ÄÄNI: ${percent(audio.settings.sfx)}`,
        change: (direction) => audio.setSfxVolume(audio.settings.sfx + direction * VOLUME_STEP),
        preview: true,
      },
    ];
    this.menu = new Menu(
      [...this.rows.map((row) => ({ label: row.label, row })), { label: 'TAKAISIN', row: null }],
      { onMove: () => audio.playSfx('select') },
    );
  }

  adjust(row, direction) {
    row.change(direction);
    this.game.audio.playSfx(row.preview ? 'hit' : 'select');
  }

  update(dt, input) {
    this.time += dt;
    if (input.wasPressed('Escape')) {
      this.game.audio.playSfx('back');
      this.onBack();
      return;
    }
    const { row } = this.menu.selected;
    if (row && input.wasPressed('ArrowLeft')) this.adjust(row, -1);
    if (row && input.wasPressed('ArrowRight')) this.adjust(row, 1);
    const item = this.menu.update(input);
    if (!item) return;
    if (item.row) {
      this.adjust(item.row, 1);
    } else {
      this.game.audio.playSfx('back');
      this.onBack();
    }
  }

  render(ctx) {
    drawVenueBackdrop(ctx, this.time);
    drawPanel(ctx, 90, 100, 460, 240);
    drawText(ctx, 'ÄÄNET', 320, 124, { align: 'center', scale: 4, color: PALETTE.red });
    this.menu.render(ctx, 320, 192, { lineHeight: 28, scale: 2 });
    drawText(ctx, 'VASEN/OIKEA = SÄÄTÖ', 320, 308, { align: 'center', scale: 2, color: PALETTE.paper });
  }
}
