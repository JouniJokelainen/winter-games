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

  render(ctx) {
    for (const scene of this.stack) scene.render(ctx);
  }
}
