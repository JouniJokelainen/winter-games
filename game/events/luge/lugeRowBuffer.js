// A software row buffer for the luge track rows: fillRect calls with opaque '#rrggbb' colours are written into an
// ImageData in plain JS and copied to the canvas with one putImageData, instead of ≈ 12 000 canvas fillRects.
// Only for content that covers every pixel of its rows (putImageData replaces pixels, it does not blend).
// putImageData also ignores the transform, the global alpha, the clip and the compositing mode: the rows must be
// drawn 1:1 with an identity transform and without any alpha or clip wrapper around the call.
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const packed = new Map();

// Two-digit hex strings 00..ff, shared by the renderers that build '#rrggbb' colours.
export const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

function pack(color) {
  let value = packed.get(color);
  if (value === undefined) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`row buffer needs an opaque #rrggbb colour, got ${color}`);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    value = LITTLE_ENDIAN ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
    packed.set(color, value);
  }
  return value;
}

// Byte order of the buffer's `pixels`: little endian is 0xAABBGGRR, big endian 0xRRGGBBAA.
export const PIXELS_LITTLE_ENDIAN = LITTLE_ENDIAN;

let image = null;

// A context-like target for rows top .. top + rows - 1 of a `width` px wide canvas, or null when `ctx` cannot take
// image data (tests' recording contexts): then the caller draws directly.
export function createRowBuffer(ctx, width, top, rows) {
  if (typeof ctx.putImageData !== 'function' || typeof ctx.createImageData !== 'function') return null;
  if (!image || image.width !== width || image.height !== rows) image = ctx.createImageData(width, rows);
  const pixels = new Uint32Array(image.data.buffer, image.data.byteOffset, width * rows);
  return {
    // Direct pixel access for per-pixel content (the ice): row y starts at (y - top) * width; see PIXELS_LITTLE_ENDIAN.
    pixels,
    width,
    top,
    fillStyle: '#000000',
    fillRect(x, y, w, h) {
      const value = pack(this.fillStyle);
      const x0 = Math.max(0, x);
      const x1 = Math.min(width, x + w);
      if (x1 <= x0) return;
      for (let row = Math.max(top, y); row < Math.min(top + rows, y + h); row++) {
        const start = (row - top) * width;
        pixels.fill(value, start + x0, start + x1);
      }
    },
    put() {
      ctx.putImageData(image, 0, top);
    },
  };
}
