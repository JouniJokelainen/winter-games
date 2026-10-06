import { drawBlinking, drawPanel, drawWinterBackdrop, Snowfall } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';
import { formatDistance, formatTime, LANDING_LABEL } from '../core/format.js';
import { lugePoints, skiJumpPoints, slalomPoints } from '../core/scoring.js';

const round = (value, decimals) => Math.round(value * 10 ** decimals) / 10 ** decimals;

// Random results so the whole game flow can be played before real events exist.
export const SIMULATORS = {
  skiJump(rng) {
    const distance = round(150 + rng() * 50, 1);
    const landing = ['perfect', 'poor', 'fall'][Math.floor(rng() * 3)];
    const points = skiJumpPoints(distance, landing);
    return {
      valid: landing !== 'fall',
      points,
      distance,
      summary: [`PITUUS ${formatDistance(distance)}`, `ALASTULO ${LANDING_LABEL[landing]}`, `PISTEET ${points}`],
    };
  },
  slalom(rng) {
    const time = round(28 + rng() * 12, 2);
    const hits = Math.floor(rng() * 3);
    const missed = Math.floor(rng() * 3);
    const valid = missed < 2;
    const points = valid ? slalomPoints({ time, hits, missed }) : 0;
    return {
      valid,
      points,
      time,
      summary: [
        `AIKA ${formatTime(time)}`,
        `OSUMAT ${hits}`,
        `OHITETUT KEPIT ${missed}`,
        valid ? `PISTEET ${points}` : 'HYLÄTTY',
      ],
    };
  },
  luge(rng) {
    const time = round(28 + rng() * 10, 2);
    const crashed = rng() < 0.2;
    const points = crashed ? 0 : lugePoints(time);
    return {
      valid: !crashed,
      points,
      time,
      summary: crashed ? ['SUISTUIT RADALTA', 'HYLÄTTY'] : [`AIKA ${formatTime(time)}`, `PISTEET ${points}`],
    };
  },
};

export class PlaceholderEventScene {
  constructor({ game, eventId, name, onComplete, rng = Math.random }) {
    this.game = game;
    this.eventId = eventId;
    this.name = name;
    this.onComplete = onComplete;
    this.rng = rng;
    this.done = false;
    this.time = 0;
    this.snow = new Snowfall();
  }

  update(dt, input) {
    this.time += dt;
    this.snow.update(dt);
    if (this.done || !input.wasPressed('Space')) return;
    this.done = true;
    const attempt = SIMULATORS[this.eventId](this.rng);
    this.game.audio.playSfx(attempt.valid ? 'finish' : 'crash');
    this.onComplete(attempt);
  }

  render(ctx) {
    drawWinterBackdrop(ctx);
    this.snow.render(ctx);
    drawPanel(ctx, 40, 70, 240, 100);
    drawText(ctx, this.name, 160, 84, { align: 'center', scale: 2, color: PALETTE.yellow });
    drawText(ctx, 'TESTILAJI', 160, 112, { align: 'center', color: PALETTE.skyLight });
    drawBlinking(ctx, 'VÄLILYÖNTI = ARVO TULOS', 160, 140, this.time, { color: PALETTE.white });
  }
}
