export function fakeInput(pressedCodes = [], typed = []) {
  const pressed = new Set(pressedCodes);
  let pending = [...typed];
  return {
    wasPressed: (code) => pressed.has(code),
    isDown: (code) => pressed.has(code),
    takeTyped: () => {
      const result = pending;
      pending = [];
      return result;
    },
  };
}
