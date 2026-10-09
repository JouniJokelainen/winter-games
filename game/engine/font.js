export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;
export const GLYPH_ADVANCE = 6;

// Each glyph: 7 rows of 5 pixels separated by "/", "#" = lit.
const RAW_GLYPHS = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.####',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '.###./..#../..#../..#../..#../..#../.###.',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/#...#/##..#/#.#.#/#..##/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  Ä: '.#.#./...../.###./#...#/#####/#...#/#...#',
  Ö: '.#.#./...../.###./#...#/#...#/#...#/.###.',
  Å: '..#../...../.###./#...#/#####/#...#/#...#',
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  1: '..#../.##../..#../..#../..#../..#../.###.',
  2: '.###./#...#/....#/...#./..#../.#.../#####',
  3: '####./....#/....#/.###./....#/....#/####.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.',
  5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '.###./#..../#..../####./#...#/#...#/.###.',
  7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
  9: '.###./#...#/#...#/.####/....#/....#/.###.',
  ' ': '...../...../...../...../...../...../.....',
  '.': '...../...../...../...../...../.##../.##..',
  ',': '...../...../...../...../.##../..#../.#...',
  ':': '...../.##../.##../...../.##../.##../.....',
  '-': '...../...../...../.###./...../...../.....',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
  ')': '.#.../..#../...#./...#./...#./..#../.#...',
  "'": '..#../..#../...../...../...../...../.....',
  '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
  '=': '...../...../#####/...../#####/...../.....',
  '<': '...#./..#../.#.../#..../.#.../..#../...#.',
  '>': '.#.../..#../...#./....#/...#./..#../.#...',
  _: '...../...../...../...../...../...../#####',
  '°': '.##../#..#./.##../...../...../...../.....',
};

export const GLYPHS = Object.fromEntries(
  Object.entries(RAW_GLYPHS).map(([char, rows]) => [char, rows.split('/')]),
);

export function glyphFor(char) {
  return GLYPHS[char.toUpperCase()] ?? GLYPHS['?'];
}

export function textWidth(text, scale = 1) {
  const length = [...String(text)].length;
  return length === 0 ? 0 : (length * GLYPH_ADVANCE - 1) * scale;
}

function paint(ctx, chars, x, y, color, scale) {
  ctx.fillStyle = color;
  chars.forEach((char, index) => {
    const rows = glyphFor(char);
    for (let row = 0; row < GLYPH_HEIGHT; row++) {
      for (let col = 0; col < GLYPH_WIDTH; col++) {
        if (rows[row][col] === '#') {
          ctx.fillRect(x + (index * GLYPH_ADVANCE + col) * scale, y + row * scale, scale, scale);
        }
      }
    }
  });
}

export function drawText(ctx, text, x, y, { color = '#ffffff', scale = 1, align = 'left', shadow = null } = {}) {
  const chars = [...String(text)];
  const width = textWidth(text, scale);
  const offset = align === 'center' ? width / 2 : align === 'right' ? width : 0;
  const left = Math.round(x - offset);
  const top = Math.round(y);
  if (shadow) paint(ctx, chars, left + scale, top + scale, shadow, scale);
  paint(ctx, chars, left, top, color, scale);
}

// Big headline text: pixels are coloured by glyph row (`colors`, top to bottom) over an outline and a
// stepped drop-shadow extrusion towards the bottom right.
export function drawGradientText(ctx, text, x, y, {
  scale = 1, align = 'left', colors, outline = null, depth = null, depthSteps = 4,
} = {}) {
  const chars = [...String(text)];
  const width = textWidth(text, scale);
  const offset = align === 'center' ? width / 2 : align === 'right' ? width : 0;
  const left = Math.round(x - offset);
  const top = Math.round(y);
  const edge = Math.max(1, Math.round(scale / 4));
  if (depth) {
    for (let step = depthSteps; step >= 1; step--) paint(ctx, chars, left + step * edge, top + step * edge, depth, scale);
  }
  if (outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      paint(ctx, chars, left + dx * edge, top + dy * edge, outline, scale);
    }
  }
  chars.forEach((char, index) => {
    const rows = glyphFor(char);
    for (let row = 0; row < GLYPH_HEIGHT; row++) {
      ctx.fillStyle = colors[Math.min(colors.length - 1, Math.floor((row * colors.length) / GLYPH_HEIGHT))];
      for (let col = 0; col < GLYPH_WIDTH; col++) {
        if (rows[row][col] === '#') {
          ctx.fillRect(left + (index * GLYPH_ADVANCE + col) * scale, top + row * scale, scale, scale);
        }
      }
    }
  });
}
