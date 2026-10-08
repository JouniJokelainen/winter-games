import assert from 'node:assert/strict';

// A small RGBA float surface (premultiplied) with source-over fillRect (hex or rgba colours), unscaled whole-pixel
// drawImage and put/createImageData: enough of a canvas to compare drawing paths pixel by pixel.
export class PixelSurface {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.px = new Float32Array(width * height * 4);
    this.fillStyle = '#000000';
    this.calls = { rects: 0, images: 0 };
  }

  getContext() {
    return this;
  }

  createImageData(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }

  // Replaces pixels, like a canvas.
  putImageData(image, dx, dy) {
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const [tx, ty] = [dx + x, dy + y];
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
        const si = (y * image.width + x) * 4;
        const di = (ty * this.width + tx) * 4;
        const a = image.data[si + 3] / 255;
        for (let k = 0; k < 3; k++) this.px[di + k] = image.data[si + k] * a;
        this.px[di + 3] = a;
      }
    }
  }

  blend(i, r, g, b, a) {
    const px = this.px;
    px[i] = px[i] * (1 - a) + r * a;
    px[i + 1] = px[i + 1] * (1 - a) + g * a;
    px[i + 2] = px[i + 2] * (1 - a) + b * a;
    px[i + 3] = px[i + 3] * (1 - a) + a;
  }

  fillRect(x, y, w, h) {
    this.calls.rects += 1;
    const style = this.fillStyle;
    const [r, g, b, a] = style.startsWith('#')
      ? [...[1, 3, 5].map((i) => parseInt(style.slice(i, i + 2), 16)), 1]
      : style.match(/[\d.]+/g).map(Number);
    for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) this.blend((yy * this.width + xx) * 4, r, g, b, a);
    }
  }

  drawImage(img, ...args) {
    this.calls.images += 1;
    const [sx, sy, sw, sh, dx, dy] = args.length === 2 ? [0, 0, img.width, img.height, ...args] : args;
    assert.ok([sx, sy, dx, dy].every(Number.isInteger), `whole-pixel drawImage ${args}`);
    if (args.length > 2) assert.deepEqual([args[6], args[7]], [sw, sh], 'unscaled drawImage');
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const [tx, ty, fx, fy] = [dx + x, dy + y, sx + x, sy + y];
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height || fx < 0 || fy < 0 || fx >= img.width || fy >= img.height) continue;
        const si = (fy * img.width + fx) * 4;
        const a = img.px[si + 3];
        if (a > 0) this.blend((ty * this.width + tx) * 4, img.px[si] / a, img.px[si + 1] / a, img.px[si + 2] / a, a);
      }
    }
  }

  // Share of pixels whose rounded RGB differs from another surface of the same size.
  differing(other) {
    let count = 0;
    for (let i = 0; i < this.px.length; i += 4) {
      if ([0, 1, 2].some((k) => Math.round(this.px[i + k]) !== Math.round(other.px[i + k]))) count += 1;
    }
    return count / (this.px.length / 4);
  }
}
