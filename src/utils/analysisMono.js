// Preserve stereo content that would disappear in a simple mono sum.
export function analysisChannel(leftEnergy, rightEnergy, mixEnergy) {
  if (mixEnergy >= Math.max(leftEnergy, rightEnergy) * 0.05) return null;
  return leftEnergy >= rightEnergy ? 0 : 1;
}

export function compactWindow(left, right, rate, window, useChannel) {
  const stride = Math.max(1, Math.floor(rate / 11025));
  const from = Math.floor(window.start * rate);
  const length = Math.floor((window.end * rate - from) / stride);
  // The full analyzer has already measured both channels. Its rough fallback
  // only needs to measure the excerpt it will actually use.
  if (useChannel === undefined) {
    let leftEnergy = 0,
      rightEnergy = 0,
      mixEnergy = 0;
    for (let i = from; i < from + length * stride; i++) {
      const l = left[i],
        r = right[i];
      leftEnergy += l * l;
      rightEnergy += r * r;
      mixEnergy += ((l + r) / 2) ** 2;
    }
    useChannel = analysisChannel(leftEnergy, rightEnergy, mixEnergy);
  }
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let offset = 0; offset < stride; offset++) {
      const at = from + i * stride + offset;
      sum +=
        useChannel === 0 ? left[at] : useChannel === 1 ? right[at] : (left[at] + right[at]) / 2;
    }
    samples[i] = sum / stride;
  }
  return { samples, rate: rate / stride };
}
