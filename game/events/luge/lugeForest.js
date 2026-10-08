// Luge forest: a luge-specific pine (light side, shadow side, snow on the branches, trunk and soft shadow when
// near), the far and middle backdrop layers, and the placement of the near trees along the track.
// Everything is deterministic from seeded rngs and drawn with whole-pixel fillRects.
import { PALETTE } from '../../engine/palette.js';
import { createRng } from '../../engine/rng.js';
import { W } from './lugeProjection.js';

const identity = (color) => color;
const SHADOW = 'rgba(96,102,124,0.22)';
const SHADOW_CORE = 'rgba(80,86,108,0.16)';
const FAR_MIST = 'rgba(214,213,223,0.5)';

// Draws one pine with its foot at (x, baseY) and the given pixel height. `tint` blends a colour toward the fog.
// `detail` (0..1) switches on the jagged edge, snow load, trunk and shadow as the tree gets near.
export function drawLugePine(ctx, x, baseY, height, { seed = 0, tint = identity, fog = 0, lean = 0 } = {}) {
  if (height < 3) return;
  const near = height >= 34;
  const trunkH = near ? Math.max(4, Math.round(height * 0.085)) : Math.max(1, Math.round(height * 0.05));
  const trunkW = Math.max(1, Math.round(height / 22));
  const crown = height - trunkH;
  const skirt = near ? 1 : 0;
  const crownBottom = baseY - trunkH + skirt;
  const tiers = height < 14 ? 1 : Math.max(2, Math.min(8, Math.round(height / 13)));
  const rng = createRng(seed * 977 + 13);
  const maxHalf = Math.max(1, Math.round(height * (0.22 + rng() * 0.12)));
  const snowy = near ? Array.from({ length: tiers }, () => rng() < 0.55) : [];

  if (near) {
    const rx = Math.round(maxHalf * 1.45);
    const ry = Math.max(2, Math.round(height / 22));
    const a = 1 - fog;
    for (let dy = 0; dy < ry; dy++) {
      const half = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2));
      ctx.fillStyle = a > 0.45 ? SHADOW : SHADOW_CORE;
      ctx.fillRect(x - half + Math.round(rx * 0.18), baseY - dy, half * 2, 1);
    }
  }
  if (trunkH > 1 || height > 8) {
    ctx.fillStyle = tint(PALETTE.wood8);
    ctx.fillRect(x - Math.floor(trunkW / 2), baseY - trunkH, trunkW, trunkH);
    if (trunkW > 1) {
      ctx.fillStyle = tint(PALETTE.trunk);
      ctx.fillRect(x - Math.floor(trunkW / 2), baseY - trunkH, Math.ceil(trunkW / 2), trunkH);
    }
  }

  const light = tint(PALETTE.pineLight);
  const mid = tint(PALETTE.pineMid);
  const dark = tint(PALETTE.pineDark);
  const deep = tint(mixDark(PALETTE.pineDark));
  const snow = tint(PALETTE.snowLight);
  const snowShade = tint(PALETTE.snowDark);
  const tierH = crown / tiers;
  for (let row = 0; row < crown; row++) {
    const t = Math.min(tiers - 1, Math.floor(row / tierH));
    const u = (row - t * tierH) / tierH;
    const cone = 0.12 + 0.88 * (row / crown);
    const flare = 0.7 + 0.3 * u;
    let half = Math.round(maxHalf * cone * flare);
    if (near && row > 2) half += Math.round(rng() * 2 - 0.6);
    half = Math.max(0, half);
    const y = crownBottom - crown + row + (near ? 0 : 0);
    const cx = x + (lean ? Math.round(lean * (1 - row / crown)) : 0);
    const left = cx - half;
    const width = half * 2 + 1;
    // Shadow side (right) first, then the mid tone and the lit left side on top.
    const underside = u > 0.78;
    ctx.fillStyle = underside ? deep : dark;
    ctx.fillRect(left, y, width, 1);
    if (half >= 1) {
      ctx.fillStyle = underside ? dark : mid;
      ctx.fillRect(left, y, Math.max(1, Math.round(width * 0.62)), 1);
      if (!underside) {
        ctx.fillStyle = light;
        ctx.fillRect(left, y, Math.max(1, Math.round(width * (row % 3 === 0 ? 0.3 : 0.4))), 1);
      }
    }
    // Snow load on the upper rows of each tier below the first.
    if (near && t > 0 && snowy[t] && u < 0.16 && half >= 3) {
      const reach = Math.round(half * (0.5 + rng() * 0.3));
      ctx.fillStyle = snow;
      ctx.fillRect(cx - reach, y, Math.max(2, Math.round(reach * 1.1)), 1);
      ctx.fillStyle = snowShade;
      ctx.fillRect(cx - reach + Math.round(reach * 1.1), y, Math.max(1, Math.round(reach * 0.8)), 1);
    } else if (!near && height >= 12 && t > 0 && u < 0.12 && half >= 2) {
      ctx.fillStyle = snow;
      ctx.fillRect(cx - Math.round(half * 0.5), y, Math.max(1, half), 1);
    }
  }
}

function mixDark(color) {
  const part = (i) => Math.round(parseInt(color.slice(1 + i * 2, 3 + i * 2), 16) * 0.72).toString(16).padStart(2, '0');
  return `#${part(0)}${part(1)}${part(2)}`;
}

// Slow noise in 0..1 that makes clearings and groups: a few sines with random phases, plus a hash cell term.
function density(seed, position) {
  const a = Math.sin(position * 0.045 + seed * 1.7);
  const b = Math.sin(position * 0.113 + seed * 3.1);
  const c = Math.sin(position * 0.021 + seed * 0.7);
  return 0.5 + 0.3 * a + 0.12 * b + 0.2 * c;
}

// Far and middle layers drawn in the backdrop, standing on the horizon and sliding with the heading.
// The far layer is dense, low and washed out by mist; the middle layer is taller and a little clearer.
const LAYERS = [
  { name: 'far', par: 0.1, spacing: 4, minH: 14, maxH: 30, rise: 4, fog: 0.5, seed: 41, thin: 0.05, step: 0 },
  { name: 'mid', par: 0.2, spacing: 9, minH: 26, maxH: 54, rise: 2, fog: 0.26, seed: 57, thin: 0.2, step: 1 },
];

export function drawForestBackdrop(ctx, { heading, horizon, tint }) {
  for (const layer of LAYERS) {
    const offset = heading * 600 * layer.par;
    const first = Math.floor(offset / layer.spacing) - 2;
    const count = Math.ceil(W / layer.spacing) + 5;
    for (let i = first; i < first + count; i++) {
      const rng = createRng(layer.seed + i * 7919);
      const sx = Math.round(i * layer.spacing - offset + (rng() - 0.5) * layer.spacing * 1.4);
      const place = density(layer.seed, i * layer.spacing);
      const keep = rng();
      const height = Math.round(layer.minH + rng() * rng() * (layer.maxH - layer.minH) * (0.6 + 0.6 * place));
      const rise = Math.round(rng() * layer.rise);
      if (keep < layer.thin + (0.55 - place) * 0.7) continue;
      drawLugePine(ctx, sx, horizon - rise, height, { seed: layer.seed + i, tint: (c) => tint(c, layer.fog + rng() * 0.08), fog: layer.fog });
    }
    if (layer.name === 'far') {
      // Mist rolling through the far trees: stronger toward the foot.
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(214,213,223,${(0.05 + (i / 17) * 0.4).toFixed(3)})`;
        ctx.fillRect(0, horizon - 20 + i, W, 1);
      }
    }
  }
}

// Near trees for `buildScenery`: grouped, with clearings, never near the track, the start and finish areas or
// the outer side of a turn. Returns objects like { type: 'pine', along, x, height, seed }.
export function forestObjects(first, last, { edge, margins }) {
  const list = [];
  for (let i = first; i <= last; i++) {
    for (const side of [-1, 1]) {
      const place = density(side > 0 ? 5 : 9, i * 12);
      if (place < 0.3) continue; // clearing
      const rng = createRng(2400 + i * 2 + (side > 0 ? 1 : 0));
      const groupSize = place > 0.62 ? 3 : place > 0.45 ? 2 : 1;
      for (let g = 0; g < groupSize; g++) {
        const along = i * 12 + rng() * 12;
        const outer = edge + 3.5 + rng() * 6 + (rng() < 0.4 ? rng() * 9 : 0);
        if (margins.some((m) => along > m.from && along < m.to && (m.side === 0 || m.side === side))) continue;
        list.push({ type: 'pine', along, x: side * outer, height: 6 + rng() * rng() * 7, seed: i * 5 + g + (side > 0 ? 3 : 0) });
      }
    }
  }
  return list;
}
