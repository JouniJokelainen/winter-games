import { RESOLUTION_SCALE } from './constants.js';

export class SceneManager {
  constructor() {
    this.stack = [];
  }

  get current() {
    return this.stack.at(-1) ?? null;
  }

  replace(scene) {
    while (this.stack.length > 0) this.stack.pop().exit?.();
    this.push(scene);
  }

  push(scene) {
    this.stack.push(scene);
    scene.enter?.();
  }

  pop() {
    const scene = this.stack.pop();
    scene?.exit?.();
    return scene;
  }

  update(dt, input) {
    this.current?.update(dt, input);
  }

  // Low-resolution scenes draw in 320×256 logical pixels scaled up; high-resolution scenes draw 1:1.
  render(ctx) {
    for (const scene of this.stack) {
      const scale = scene.highResolution ? 1 : RESOLUTION_SCALE;
      ctx.setTransform?.(scale, 0, 0, scale, 0, 0);
      scene.render(ctx);
    }
  }
}
