export function fakeInput(pressedCodes = [], typed = [], { held = pressedCodes } = {}) {
  const counts = new Map();
  for (const code of pressedCodes) counts.set(code, (counts.get(code) ?? 0) + 1);
  const down = new Set(held);
  let pending = [...typed];
  return {
    wasPressed: (code) => counts.has(code),
    pressCount: (code) => counts.get(code) ?? 0,
    isDown: (code) => down.has(code),
    takeTyped: () => {
      const result = pending;
      pending = [];
      return result;
    },
  };
}
