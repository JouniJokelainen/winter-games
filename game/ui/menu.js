import { drawText } from '../engine/font.js';
import { PALETTE } from '../engine/palette.js';

export function visibleWindow(count, index, maxVisible) {
  if (count <= maxVisible) return [0, count];
  const start = Math.min(Math.max(0, index - Math.floor(maxVisible / 2)), count - maxVisible);
  return [start, start + maxVisible];
}

function labelOf(item) {
  return typeof item.label === 'function' ? item.label() : item.label;
}

export class Menu {
  constructor(items, { onMove = () => {} } = {}) {
    this.items = items;
    this.index = 0;
    this.onMove = onMove;
  }

  get selected() {
    return this.items[this.index];
  }

  update(input) {
    const count = this.items.length;
    if (input.wasPressed('ArrowUp')) {
      this.index = (this.index - 1 + count) % count;
      this.onMove();
    } else if (input.wasPressed('ArrowDown')) {
      this.index = (this.index + 1) % count;
      this.onMove();
    } else if (input.wasPressed('Space') || input.wasPressed('Enter')) {
      return this.selected;
    }
    return null;
  }

  render(ctx, centerX, y, { lineHeight = 12, maxVisible = Infinity } = {}) {
    const [start, end] = visibleWindow(this.items.length, this.index, maxVisible);
    for (let i = start; i < end; i++) {
      const isSelected = i === this.index;
      const text = isSelected ? `> ${labelOf(this.items[i])} <` : labelOf(this.items[i]);
      drawText(ctx, text, centerX, y + (i - start) * lineHeight, {
        align: 'center',
        color: isSelected ? PALETTE.yellow : PALETTE.white,
      });
    }
  }
}
