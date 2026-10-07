// A canvas context stand-in that records every fillRect with its colour.
export function recordingCtx() {
  const rects = [];
  return {
    rects,
    fillStyle: null,
    fillRect(x, y, w, h) {
      for (const value of [x, y, w, h]) {
        if (!Number.isFinite(value)) throw new Error(`non-finite rect value ${value}`);
      }
      rects.push({ x, y, w, h, color: this.fillStyle });
    },
  };
}
