// Capsule skeleton rasteriser shared by the skiers: limbs are thick capsules and discs, rasterised
// per frame as whole pixels so rotation stays crisp. Local coordinates: x right, y up.

export function fillCapsule(ctx, ax, ay, bx, by, radius, colorAt) {
  const minX = Math.floor(Math.min(ax, bx) - radius);
  const maxX = Math.ceil(Math.max(ax, bx) + radius);
  const minY = Math.floor(Math.min(ay, by) - radius);
  const maxY = Math.ceil(Math.max(ay, by) + radius);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = Math.max(dx * dx + dy * dy, 1e-9);
  const length = Math.sqrt(lengthSq);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
      const cx = ax + dx * t;
      const cy = ay + dy * t;
      const distance = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
      if (distance > radius) continue;
      // Signed offset across the limb, -1 (left of a→b, i.e. "up" for a limb pointing right) .. 1.
      const across = ((px - cx) * (-dy / length) + (py - cy) * (dx / length)) / radius;
      ctx.fillStyle = colorAt(across, t);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// Like fillCapsule, but the radius changes linearly from radiusA at a to radiusB at b (round caps of those radii).
// `across` is the signed offset relative to the local radius, so shading follows the taper.
export function fillTaper(ctx, ax, ay, bx, by, radiusA, radiusB, colorAt) {
  const reach = Math.max(radiusA, radiusB);
  const minX = Math.floor(Math.min(ax, bx) - reach);
  const maxX = Math.ceil(Math.max(ax, bx) + reach);
  const minY = Math.floor(Math.min(ay, by) - reach);
  const maxY = Math.ceil(Math.max(ay, by) + reach);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = Math.max(dx * dx + dy * dy, 1e-9);
  const length = Math.sqrt(lengthSq);
  const nx = -dy / length;
  const ny = dx / length;
  const dr = radiusB - radiusA;
  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
      const cx = ax + dx * t;
      const cy = ay + dy * t;
      const radius = radiusA + dr * t;
      const distance = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
      if (distance > radius) continue;
      ctx.fillStyle = colorAt(((px - cx) * nx + (py - cy) * ny) / radius, t);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// A drawing context that merges consecutive same-colour pixels of a row into one fillRect(x, y, w, 1) on `ctx`
// and sets ctx.fillStyle only when it changes. Paints exactly the pixels it is given (opaque colours, or any colour
// when pixels do not overlap). Call flush() when done.
export function pixelRuns(ctx) {
  let color = null;
  let set = null;
  let runX = 0;
  let runY = 0;
  let runW = 0;
  const flush = () => {
    if (runW === 0) return;
    if (set !== color) ctx.fillStyle = set = color;
    ctx.fillRect(runX, runY, runW, 1);
    runW = 0;
  };
  return {
    fillStyle: null,
    fillRect(x, y, w, h) {
      if (w === 1 && h === 1) {
        if (runW > 0 && y === runY && x === runX + runW && this.fillStyle === color) {
          runW += 1;
          return;
        }
        flush();
        color = this.fillStyle;
        runX = x;
        runY = y;
        runW = 1;
        return;
      }
      flush();
      if (set !== this.fillStyle) ctx.fillStyle = set = this.fillStyle;
      ctx.fillRect(x, y, w, h);
    },
    flush,
  };
}

// fillTaper with the pixels of each row merged into runs of one colour: the same pixels, far fewer draw calls.
export function fillTaperRuns(ctx, ax, ay, bx, by, radiusA, radiusB, colorAt) {
  const runs = pixelRuns(ctx);
  fillTaper(runs, ax, ay, bx, by, radiusA, radiusB, colorAt);
  runs.flush();
}

export function solid(color) {
  return () => color;
}

// Two-tone shading: the side facing up-left is lit.
export function shaded(light, dark, split = 0.35) {
  return (across) => (across > split ? dark : light);
}

export function transform(x, y, angle, [lx, ly]) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x + lx * cos - ly * sin, y - (lx * sin + ly * cos)];
}
