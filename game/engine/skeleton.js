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
      const distance = Math.hypot(px - cx, py - cy);
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
      const distance = Math.hypot(px - cx, py - cy);
      if (distance > radius) continue;
      ctx.fillStyle = colorAt(((px - cx) * nx + (py - cy) * ny) / radius, t);
      ctx.fillRect(x, y, 1, 1);
    }
  }
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
