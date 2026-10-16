/** A page-local cancellation stamp, independent of Runtime and Save. */
export function createEffectEpoch() {
  let epoch = 0;
  let disposed = false;
  return Object.freeze({
    current: () => epoch,
    invalidate: () => ++epoch,
    valid: (token: number) => !disposed && token === epoch,
    dispose: () => { disposed = true; epoch += 1; },
  });
}
