// Luge venue: tiered stands at the start and the finish, small spectator groups on the outer side of the main
// turns, and low advertising boards. Everything is a trackside object like the others in lugeRender.js: the
// scenery list asks `venueObjects` for the objects in view and `drawVenueObject` paints them.
// Spectators are cheap: a body, a head, a hat band and one of two arm poses, drawn in colour passes per object.
import { drawText } from '../../engine/font.js';
import { PALETTE } from '../../engine/palette.js';
import { CAM_H, FOCAL, HALF_W, HORIZON, sample, W, WALL_T } from './lugeProjection.js';
import { FINISH_S, TURNS } from './lugeTrack.js';

const EDGE = HALF_W + WALL_T;
const ONE = [null];
const SCRATCH = []; // reused per object
const ROW_DEPTH = 0.9; // metres per tier, across
const TIER_STEP = 0.5; // metres of rise per tier
const BAY = 1.5; // metres between two spectator columns along the track
const WAVE_PERIOD = 0.5; // seconds for one full wave (two arm poses)
const VENUE_RANGE = 150; // metres; beyond this the venue is just fog
const MIN_PIXELS = 2; // metres → pixels below which a spectator is not worth drawing

// Outfits: jacket colour and the colour of the hat band. Bodies are listed first so tests can count them.
const OUTFITS = [
  { body: PALETTE.suitPink, hat: PALETTE.paper },
  { body: PALETTE.guide, hat: PALETTE.red },
  { body: PALETTE.wood2, hat: PALETTE.concrete3 },
  { body: PALETTE.pineLight, hat: PALETTE.orange },
  { body: PALETTE.red, hat: PALETTE.night },
];
const FLAG_COLORS = [PALETTE.paper, PALETTE.red];
const TROUSERS = PALETTE.concrete3;

const STAND_STYLES = {
  concrete: { face: PALETTE.concrete1, lip: PALETTE.concrete0, edge: PALETTE.concrete3, back: PALETTE.concrete2 },
  wood: { face: PALETTE.wood5, lip: PALETTE.wood2, edge: PALETTE.wood7, back: PALETTE.wood6 },
};

// Boards: a plain colour field with white stripes or white text. No brand names.
const BOARD_STYLES = [
  { field: PALETTE.slate, ink: PALETTE.paper, kind: 'text' },
  { field: PALETTE.darkGrey, ink: PALETTE.paper, kind: 'stripes' },
  { field: PALETTE.steelDark, ink: PALETTE.paper, kind: 'band' },
];
const BOARD_TEXT = 'WINTER GAMES';
const BOARD_TEXT_MIN_WIDTH = 80;

// Deterministic 0..1 hash of three integers.
function hash(a, b, c) {
  let h = Math.imul(a + 0x9e3779b1, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// ---- spectators ---------------------------------------------------------------------------------------

// Outfit by weight: the loud pink and red are rarer than the calm navy, mustard and green.
const OUTFIT_WEIGHTS = [0.14, 0.26, 0.26, 0.2, 0.14];
function pickOutfit(roll) {
  let acc = 0;
  for (let i = 0; i < OUTFIT_WEIGHTS.length; i++) {
    acc += OUTFIT_WEIGHTS[i];
    if (roll < acc) return i;
  }
  return OUTFIT_WEIGHTS.length - 1;
}

// One spectator: outfit, what the arm does, a wave phase and where the body stands.
function spectator(seed, k, cx, bottom, legs) {
  const kindRoll = hash(seed, k, 2);
  return {
    cx,
    bottom,
    legs,
    outfit: pickOutfit(hash(seed, k, 1)),
    kind: kindRoll < 0.3 ? 'wave' : kindRoll < 0.4 ? 'flag' : 'idle',
    flag: Math.floor(hash(seed, k, 3) * FLAG_COLORS.length),
    phase: hash(seed, k, 4) * 4,
    left: hash(seed, k, 5) < 0.5,
  };
}

// ---- placement ----------------------------------------------------------------------------------------

const GROUP_TURNS = [2, 4, 6, 8]; // turns 3, 5, 7, 9

function standBays(side, from, to, style, rows, seed) {
  const bays = [];
  for (let along = from, i = 0; along <= to; along += BAY, i++) {
    const bay = { type: 'bay', along, x: side * (EDGE + 1.4), side, rows, style, seed: seed * 1000 + i, people: [] };
    for (let r = 0; r < rows; r++) if (hash(bay.seed, r, 0) >= 0.1) bay.people.push({ r, spec: spectator(bay.seed, r, 0, 0, 0) }); // else an empty seat
    bays.push(bay);
  }
  return bays;
}

function buildVenue() {
  const list = [
    ...standBays(1, 2, 16, 'wood', 4, 1),
    ...standBays(-1, 15, 31, 'wood', 4, 2),
    ...standBays(1, FINISH_S - 24, FINISH_S + 14, 'concrete', 4, 3),
    ...standBays(-1, FINISH_S - 24, FINISH_S + 14, 'concrete', 4, 4),
  ];
  for (const index of GROUP_TURNS) {
    const turn = TURNS[index];
    const outer = turn.k > 0 ? -1 : 1;
    const along = turn.at + 6 + hash(index, 1, 1) * 6;
    const seed = 40 + index;
    const members = Array.from({ length: 5 + (index % 3) }, (_, k) => ({
      dz: (hash(seed, k, 7) - 0.5) * 4,
      dx: (hash(seed, k, 8) - 0.5) * 3.6,
      spec: spectator(seed, k, 0, 0, 0.5),
    })).sort((a, b) => b.dz - a.dz); // far first
    list.push({ type: 'group', along, x: outer * (EDGE + 5.4), side: outer, members });
  }
  const groups = list.filter((o) => o.type === 'group');
  for (let along = 90, i = 0; along < FINISH_S - 30; along += 60, i++) {
    for (const side of [-1, 1]) {
      const at = along + (side > 0 ? 0 : 30);
      if (groups.some((g) => g.side === side && Math.abs(g.along - at) < 14)) continue; // the group has the spot
      list.push({ type: 'board', along: at, x: side * (EDGE + 3.4), side, style: (i + (side > 0 ? 0 : 1)) % BOARD_STYLES.length });
    }
  }
  return list.sort((a, b) => a.along - b.along);
}

const VENUE = buildVenue();

// Stretches along the track where trees must stay clear of a board: { from, to, side }.
export const BOARD_CLEARANCE = VENUE.filter((o) => o.type === 'board').map((o) => ({ from: o.along - 6, to: o.along + 6, side: o.side }));

export const isVenueObject = (object) => object.type === 'bay' || object.type === 'group' || object.type === 'board';

// Venue objects whose along lies in [from, to].
export function venueObjects(from, to) {
  return VENUE.filter((o) => o.along >= from && o.along <= to);
}

// ---- spectators ---------------------------------------------------------------------------------------

// Draws spectators in colour passes: trousers, jackets (with arms), skin, hat bands, flags.
const pose = (clock, s) => Math.floor(clock / (WAVE_PERIOD / 2) + s.phase) & 1;
const legsOf = (s, m) => Math.round(s.legs * m);

function drawSpectators(ctx, list, m, clock, tint) {
  if (list.length === 0) return;
  const bw = Math.max(1, Math.round(0.5 * m));
  const bh = Math.max(1, Math.round(0.7 * m));
  const hw = Math.max(1, Math.round(0.26 * m));
  const hh = Math.max(1, Math.round(0.28 * m));
  const detail = m >= 7;

  ctx.fillStyle = tint(TROUSERS);
  for (const s of list) if (s.legs > 0) ctx.fillRect(s.cx - (bw >> 1), s.bottom - legsOf(s, m), bw, legsOf(s, m));

  const armW = Math.max(1, Math.round(0.14 * m));
  for (let o = 0; o < OUTFITS.length; o++) {
    let started = false;
    for (const s of list) {
      if (s.outfit !== o) continue;
      if (!started) {
        ctx.fillStyle = tint(OUTFITS[o].body);
        started = true;
      }
      const top = s.bottom - legsOf(s, m) - bh;
      ctx.fillRect(s.cx - (bw >> 1), top, bw, bh);
      if (detail && s.kind === 'wave') {
        const up = pose(clock, s) === 1 ? Math.round(0.62 * m) : Math.round(0.3 * m);
        const x = s.left ? s.cx - (bw >> 1) - armW + 1 : s.cx - (bw >> 1) + bw - 1;
        ctx.fillRect(x, top - up, armW, up + Math.round(0.3 * m));
      }
    }
  }

  ctx.fillStyle = tint(PALETTE.skin);
  for (const s of list) {
    const top = s.bottom - legsOf(s, m) - bh;
    ctx.fillRect(s.cx - (hw >> 1), top - hh, hw, hh);
    if (detail && s.kind === 'wave') {
      const up = pose(clock, s) === 1 ? Math.round(0.62 * m) : Math.round(0.3 * m);
      const hand = Math.max(2, armW);
      const x = s.left ? s.cx - (bw >> 1) - armW + 1 : s.cx - (bw >> 1) + bw - 1;
      ctx.fillRect(x, top - up - hand + 1, hand, hand);
    }
  }

  if (m >= 5) {
    const band = Math.max(1, Math.round(0.1 * m));
    for (let o = 0; o < OUTFITS.length; o++) {
      let started = false;
      for (const s of list) {
        if (s.outfit !== o) continue;
        if (!started) {
          ctx.fillStyle = tint(OUTFITS[o].hat);
          started = true;
        }
        ctx.fillRect(s.cx - (hw >> 1), s.bottom - legsOf(s, m) - bh - hh, hw, band);
      }
    }
  }

  if (detail) {
    const fw = Math.max(2, Math.round(0.34 * m));
    const fh = Math.max(2, Math.round(0.2 * m));
    for (const s of list) {
      if (s.kind !== 'flag') continue;
      const top = s.bottom - legsOf(s, m) - bh;
      const px = s.left ? s.cx - (bw >> 1) : s.cx + (bw >> 1) - 1;
      const poleTop = top - Math.round(0.6 * m);
      ctx.fillStyle = tint(PALETTE.paperDim);
      ctx.fillRect(px, poleTop, 1, Math.round(0.6 * m) + Math.round(0.2 * m));
      ctx.fillStyle = tint(FLAG_COLORS[s.flag]);
      ctx.fillRect(pose(clock, s) === 1 ? px - fw + 1 : px, poleTop, fw, fh);
    }
  }
}

// ---- objects ------------------------------------------------------------------------------------------

function drawBay(ctx, object, sx, base, m, tint, clock) {
  const style = STAND_STYLES[object.style];
  const rd = ROW_DEPTH * m;
  const side = object.side;
  const people = SCRATCH;
  people.length = 0;
  const edge = (r) => Math.round(sx + side * r * rd);
  for (let r = 0; r < object.rows; r++) {
    const a = edge(r);
    const b = edge(r + 1);
    const left = Math.min(a, b);
    const width = Math.abs(b - a);
    if (left > W || left + width < 0) continue;
    const top = base - Math.round((TIER_STEP * (r + 1) + 0.1) * m);
    ctx.fillStyle = tint(style.face);
    ctx.fillRect(left, top, width, base - top);
    ctx.fillStyle = tint(style.lip);
    ctx.fillRect(left, top, width, 1);
    ctx.fillStyle = tint(style.edge);
    ctx.fillRect(side > 0 ? left : left + width - 1, top, 1, base - top);
  }
  for (const p of object.people) {
    p.spec.cx = Math.round(sx + side * (p.r + 0.5) * rd);
    p.spec.bottom = base - Math.round((TIER_STEP * (p.r + 1) + 0.1) * m);
    people.push(p.spec);
  }
  // Rear wall behind the top tier so the stand reads as one solid mass.
  const rearA = edge(object.rows);
  const wall = Math.max(1, Math.round(0.12 * m));
  const wallTop = base - Math.round((TIER_STEP * object.rows + 1.5) * m);
  ctx.fillStyle = tint(style.back);
  ctx.fillRect(side > 0 ? rearA : rearA - wall, wallTop, wall, base - wallTop);
  drawSpectators(ctx, people, m, clock, tint);
}

function drawGroup(ctx, object, tint, clock, look, s) {
  const z0 = object.along - s;
  for (const member of object.members) {
    const z = z0 + member.dz;
    if (z <= 2.3) continue;
    const mm = FOCAL / z;
    member.spec.cx = Math.round(W / 2 + (sample(look.L, z) + object.x + member.dx) * mm);
    member.spec.bottom = Math.round(HORIZON + CAM_H * mm);
    ONE[0] = member.spec;
    drawSpectators(ctx, ONE, mm, clock, tint);
  }
}

function drawBoard(ctx, object, sx, base, m, tint) {
  const width = Math.round(3 * m);
  const high = Math.max(2, Math.round(0.8 * m));
  const left = sx - (width >> 1);
  const lift = Math.max(1, Math.round(0.12 * m));
  const top = base - lift - high;
  const style = BOARD_STYLES[object.style];
  ctx.fillStyle = tint(PALETTE.concrete2);
  ctx.fillRect(left + Math.round(0.2 * m), base - lift, Math.max(1, Math.round(0.1 * m)), lift);
  ctx.fillRect(left + width - Math.round(0.3 * m), base - lift, Math.max(1, Math.round(0.1 * m)), lift);
  ctx.fillStyle = tint(style.field);
  ctx.fillRect(left, top, width, high);
  ctx.fillStyle = tint(style.ink);
  if (style.kind === 'text' && width >= BOARD_TEXT_MIN_WIDTH && high >= 12) {
    drawText(ctx, BOARD_TEXT, sx, top + ((high - 7) >> 1), { align: 'center', scale: 1, color: tint(style.ink) });
  } else if (style.kind === 'stripes') {
    const step = Math.max(2, Math.round(0.5 * m));
    for (let x = left + (step >> 1); x < left + width - 1; x += step) ctx.fillRect(x, top, Math.max(1, step >> 1), high);
  } else {
    const band = Math.max(1, Math.round(high * 0.28));
    ctx.fillRect(left, top + ((high - band) >> 1), width, band);
    if (style.kind === 'text') ctx.fillRect(left + (width >> 2), top + ((high - band) >> 1), width >> 1, band);
  }
  ctx.fillStyle = tint(PALETTE.paperDim);
  ctx.fillRect(left, top, width, 1);
}

// Draws one venue object. `info` carries what drawObject already worked out: the projected x of the object
// (`sx`), the ground row (`base`), the scale `m` in pixels per metre, the fog `tint`, the distance `z`, the clock.
// Returns false for types it does not handle.
export function drawVenueObject(ctx, object, info) {
  const { sx, base, m, tint, z, clock, look, s } = info;
  if (object.type !== 'bay' && object.type !== 'group' && object.type !== 'board') return false;
  if (z > VENUE_RANGE || m < MIN_PIXELS) return true;
  if (object.type === 'bay') drawBay(ctx, object, sx, base, m, tint, clock);
  else if (object.type === 'group') drawGroup(ctx, object, tint, clock, look, s);
  else drawBoard(ctx, object, sx, base, m, tint);
  return true;
}
