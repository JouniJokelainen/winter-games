import { drawBlinking, drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { EVENTS } from '../events/registry.js';

const STATUS_TEXT = {
  saving: 'TALLENNETAAN...',
  published: 'TULOS TALLENNETTU JA JULKAISTU',
  saved: 'TULOS TALLENNETTU (EI JULKAISTU)',
  failed: 'TALLENNUS EPÄONNISTUI',
};

export class FinalScene {
  constructor({ game, competition, onDone }) {
    this.game = game;
    this.competition = competition;
    this.onDone = onDone;
    this.status = 'saving';
    this.time = 0;
    this.snow = new Snowfall(90);
  }

  enter() {
    this.game.audio.playSfx('finish');
    this.save();
  }

  save() {
    this.status = 'saving';
    this.game.repository.saveResult(this.competition.toPayload())
      .then((response) => { this.status = response.pushed ? 'published' : 'saved'; })
      .catch(() => { this.status = 'failed'; });
  }

  update(dt, input) {
    this.time += dt;
    this.snow.update(dt);
    if (this.status === 'saving') return;
    if (this.status === 'failed' && input.wasPressed('Enter')) {
      this.save();
      return;
    }
    if (input.wasPressed('Space')) {
      this.game.audio.playSfx('confirm');
      this.onDone();
    }
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawPanel(ctx, 30, 20, 260, 210);
    drawText(ctx, 'LOPPUTULOKSET', 160, 32, { align: 'center', scale: 2, color: PALETTE.yellow, shadow: PALETTE.darkRed });
    drawText(ctx, this.competition.nickname, 160, 56, { align: 'center', color: PALETTE.skyLight });
    this.competition.eventIds.forEach((eventId, index) => {
      const y = 78 + index * 14;
      drawText(ctx, EVENTS[eventId].name, 50, y, { color: PALETTE.white });
      drawText(ctx, String(this.competition.eventResult(eventId).points), 270, y, { align: 'right', color: PALETTE.white });
    });
    ctx.fillStyle = PALETTE.skyLight;
    ctx.fillRect(50, 122, 220, 1);
    drawText(ctx, 'YHTEENSÄ', 50, 132, { scale: 2, color: PALETTE.yellow });
    drawText(ctx, String(this.competition.total), 270, 132, { align: 'right', scale: 2, color: PALETTE.yellow });
    const statusColor = this.status === 'failed' ? PALETTE.red : PALETTE.white;
    drawText(ctx, STATUS_TEXT[this.status], 160, 166, { align: 'center', color: statusColor });
    if (this.status === 'failed') drawText(ctx, 'ENTER = YRITÄ UUDELLEEN', 160, 180, { align: 'center', color: PALETTE.white });
    if (this.status !== 'saving') drawBlinking(ctx, 'VÄLILYÖNTI = VALIKKOON', 160, 210, this.time, { color: PALETTE.skyLight });
  }
}
