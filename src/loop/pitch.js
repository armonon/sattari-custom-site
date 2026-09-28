// YIN's cumulative mean normalized difference picks the first plausible period,
// rather than the strongest correlation at an integer multiple of that period.
export function detectFundamental(samples, rate, minHz = 70, maxHz = 1320) {
  let energy = 0;
  for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
  const rms = Math.sqrt(energy / samples.length);
  if (!Number.isFinite(rms) || rms < 0.008) return null;
  const maxTau = Math.min(Math.ceil(rate / minHz), Math.floor(samples.length / 2) - 1);
  const minTau = Math.max(2, Math.floor(rate / maxHz));
  if (maxTau <= minTau) return null;
  const size = samples.length - maxTau;
  const difference = new Float32Array(maxTau + 1);
  let cumulative = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < size; i++) {
      const d = samples[i] - samples[i + tau];
      sum += d * d;
    }
    cumulative += sum;
    difference[tau] = cumulative > 0 ? (sum * tau) / cumulative : 1;
  }
  for (let tau = minTau; tau < maxTau; tau++) {
    if (difference[tau] > 0.15) continue;
    while (tau + 1 <= maxTau && difference[tau + 1] < difference[tau]) tau++;
    if (tau >= maxTau) return null;
    const a = difference[tau - 1],
      b = difference[tau],
      c = difference[tau + 1];
    const divisor = a - 2 * b + c;
    const period = tau + (divisor ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * divisor))) : 0);
    const frequency = rate / period;
    if (frequency < minHz || frequency > maxHz) return null;
    const exact = 69 + 12 * Math.log2(frequency / 440);
    const midi = Math.round(exact);
    return { frequency, midi, cents: Math.round((exact - midi) * 100), clarity: 1 - b, rms };
  }
  return null;
}

export function reduceSampleRate(samples, rate, target = 8000) {
  const stride = Math.max(1, Math.floor(rate / target));
  if (stride === 1) return { samples, rate };
  const result = new Float32Array(Math.floor(samples.length / stride));
  for (let i = 0; i < result.length; i++) {
    let sum = 0;
    for (let j = 0; j < stride; j++) sum += samples[i * stride + j];
    result[i] = sum / stride;
  }
  return { samples: result, rate: rate / stride };
}
