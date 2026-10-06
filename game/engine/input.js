const GAME_KEYS = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'Enter', 'Backspace']);

export class Input {
  constructor(target = null) {
    this.down = new Set();
    this.pressed = new Set();
    this.typed = [];
    if (target) {
      target.addEventListener('keydown', (event) => this.onKeyDown(event));
      target.addEventListener('keyup', (event) => this.onKeyUp(event));
      target.addEventListener('blur', () => this.reset());
    }
  }

  onKeyDown(event) {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (!event.repeat) this.pressed.add(event.code);
    this.down.add(event.code);
    if (event.key.length === 1) this.typed.push(event.key);
  }

  onKeyUp(event) {
    this.down.delete(event.code);
  }

  reset() {
    this.down.clear();
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  takeTyped() {
    const typed = this.typed;
    this.typed = [];
    return typed;
  }

  // Call once after every fixed update tick so a press is seen by exactly one tick.
  endFrame() {
    this.pressed.clear();
    this.typed = [];
  }
}
