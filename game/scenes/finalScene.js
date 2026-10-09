import { FINALE_THEME } from '../audio/songs.js';
import { drawBlinking, drawPanel } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { drawVenueBackdrop } from '../engine/venueBackdrop.js';
import { EVENTS } from '../events/registry.js';

const STATUS_TEXT = {
  saving: 'TALLENNETAAN...',
  local: 'TULOS TALLENNETTU SELAIMEEN',
  remote: 'TULOS TALLENNETTU TULOSTAULUUN',
  published: 'TULOS TALLENNETTU JA JULKAISTU',
  saved: 'TULOS TALLENNETTU (EI JULKAISTU)',
  failed: 'TALLENNUS EPÄONNISTUI',
  taken: 'NIMIMERKKI ON VARATTU',
};

function statusFor(response) {
  if (response.local) return 'local';
  if (response.remote) return 'remote';
  return response.pushed ? 'published' : 'saved';
}

export class FinalScene {
  constructor({ game, competition, onDone }) {
    this.game = game;
    this.competition = competition;
    this.onDone = onDone;
    this.status = 'saving';
    this.recoveryCode = null;
    this.time = 0;
    this.highResolution = true;
  }

  enter() {
    this.game.audio.playSfx('finish');
    this.game.audio.playSong(FINALE_THEME);
    this.save();
  }

  save() {
    this.status = 'saving';
    this.game.repository.saveResult(this.competition.toPayload())
      .then((response) => {
        this.status = statusFor(response);
        this.recoveryCode = response.recoveryCode ?? null;
      })
      .catch((error) => { this.status = /taken/i.test(error?.message ?? '') ? 'taken' : 'failed'; });
  }

  update(dt, input) {
    this.time += dt;
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
    drawVenueBackdrop(ctx, this.time);
    drawPanel(ctx, 60, 40, 520, 420);
    drawText(ctx, 'LOPPUTULOKSET', 320, 64, { align: 'center', scale: 4, color: PALETTE.red });
    drawText(ctx, this.competition.nickname, 320, 112, { align: 'center', scale: 2, color: PALETTE.paperDim });
    this.competition.eventIds.forEach((eventId, index) => {
      const y = 156 + index * 28;
      drawText(ctx, EVENTS[eventId].name, 100, y, { scale: 2, color: PALETTE.paper });
      drawText(ctx, String(this.competition.eventResult(eventId).points), 540, y, { align: 'right', scale: 2, color: PALETTE.paper });
    });
    ctx.fillStyle = PALETTE.slateEdge;
    ctx.fillRect(100, 240, 440, 2);
    drawText(ctx, 'YHTEENSÄ', 100, 260, { scale: 4, color: PALETTE.red });
    drawText(ctx, String(this.competition.total), 540, 260, { align: 'right', scale: 4, color: PALETTE.red });
    const statusColor = this.status === 'failed' || this.status === 'taken' ? PALETTE.red : PALETTE.paper;
    drawText(ctx, STATUS_TEXT[this.status], 320, 332, { align: 'center', scale: 2, color: statusColor });
    if (this.status === 'failed') drawText(ctx, 'ENTER = YRITÄ UUDELLEEN', 320, 360, { align: 'center', scale: 2, color: PALETTE.paper });
    if (this.recoveryCode) {
      drawText(ctx, 'PALAUTUSKOODI (KIRJOITA YLÖS)', 320, 372, { align: 'center', scale: 1, color: PALETTE.paperDim });
      drawText(ctx, this.recoveryCode, 320, 388, { align: 'center', scale: 2, color: PALETTE.paper });
    }
    if (this.status !== 'saving') drawBlinking(ctx, 'VÄLILYÖNTI = VALIKKOON', 320, 420, this.time, { scale: 2, color: PALETTE.paperDim });
  }
}
