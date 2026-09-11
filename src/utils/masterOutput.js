export const DEFAULT_MASTER_PROCESSING = Object.freeze({
  low: 0,
  mid: 0,
  high: 0,
  lowCut: 20,
  width: 100,
  ceiling: -1,
  bypass: false,
});

export function normalizeMasterProcessing(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const number = (key, min, max) => {
    const value = Number(input[key] ?? DEFAULT_MASTER_PROCESSING[key]);
    return Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : DEFAULT_MASTER_PROCESSING[key];
  };
  return {
    low: number('low', -12, 12),
    mid: number('mid', -12, 12),
    high: number('high', -12, 12),
    lowCut: number('lowCut', 20, 200),
    width: number('width', 0, 150),
    ceiling: number('ceiling', -12, -0.1),
    bypass: input.bypass === true,
  };
}

export function masterGain(value) {
  const number = Number(value);
  return Math.pow(Math.min(125, Math.max(0, Number.isFinite(number) ? number : 100)) / 100, 1.35);
}

export function monitorGain({ muted = false, dimmed = false } = {}) {
  return muted ? 0 : dimmed ? Math.pow(10, -12 / 20) : 1;
}

// Windowed sample measurements, not integrated LUFS or oversampled true peak.
export function measureMasterChannels(left, right = left) {
  let peakL = 0,
    peakR = 0,
    sumL = 0,
    sumR = 0,
    cross = 0;
  const count = Math.min(left?.length || 0, right?.length || 0);
  for (let i = 0; i < count; i += 1) {
    const l = Number.isFinite(left[i]) ? left[i] : 0;
    const r = Number.isFinite(right[i]) ? right[i] : 0;
    peakL = Math.max(peakL, Math.abs(l));
    peakR = Math.max(peakR, Math.abs(r));
    sumL += l * l;
    sumR += r * r;
    cross += l * r;
  }
  const db = (value) => (value > 0 ? Math.max(-96, 20 * Math.log10(value)) : -96);
  return {
    left: db(peakL),
    right: db(peakR),
    peak: db(Math.max(peakL, peakR)),
    rms: db(count ? Math.sqrt((sumL + sumR) / (2 * count)) : 0),
    correlation:
      sumL * sumR > 1e-16 ? Math.min(1, Math.max(-1, cross / Math.sqrt(sumL * sumR))) : null,
    clipped: peakL >= 1 || peakR >= 1,
  };
}
