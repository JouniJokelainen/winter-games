export function createFixedStepper(step, maxSteps = 5) {
  let accumulator = 0;
  return function advance(elapsedSeconds, tick) {
    accumulator += Math.min(elapsedSeconds, step * maxSteps);
    let steps = 0;
    while (accumulator >= step) {
      tick(step);
      accumulator -= step;
      steps += 1;
    }
    return steps;
  };
}

export function startLoop({ step, update, render }) {
  const advance = createFixedStepper(step);
  let last = performance.now();
  function frame(now) {
    advance((now - last) / 1000, update);
    last = now;
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
