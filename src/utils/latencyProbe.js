export function probeSignal(length = 1024) {
  let seed = 7231,
    previous = 0;
  return Float32Array.from({ length }, (_, i) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    previous = previous * 0.7 + ((seed / 4294967296) * 2 - 1) * 0.3;
    return previous * Math.sin((Math.PI * i) / (length - 1)) * 0.12;
  });
}

// Compare captured PCM to emitted PCM, not AudioContext latency estimates.
// Polarity inversion is accepted; weak/ambiguous correlation is not a result.
export function measureLoopback(capture, signal, starts, sampleRate, maxDelay = 0.5) {
  const energy = signal.reduce((sum, v) => sum + v * v, 0);
  const results = starts.map((start) => {
    let best = 0,
      lag = -1;
    for (
      let delay = 0;
      delay < sampleRate * maxDelay && start + delay + signal.length <= capture.length;
      delay++
    ) {
      let dot = 0,
        power = 0;
      for (let i = 0; i < signal.length; i++) {
        const value = capture[start + delay + i];
        dot += value * signal[i];
        power += value * value;
      }
      const correlation = power > 1e-10 ? Math.abs(dot) / Math.sqrt(power * energy) : 0;
      if (correlation > best) {
        best = correlation;
        lag = delay;
      }
    }
    if (best < 0.65 || lag < 0)
      throw new Error(
        'No reliable loopback detected. Check the cable/channels; no latency result is certified.'
      );
    return { samples: lag, milliseconds: (lag * 1000) / sampleRate, correlation: best };
  });
  const values = results.map((r) => r.milliseconds).sort((a, b) => a - b);
  if (values[values.length - 1] - values[0] > 5)
    throw new Error('Loopback timing is unstable (>5 ms spread). Repeat with a wired interface.');
  return {
    measured: true,
    sampleRate,
    medianMs: values[Math.floor(values.length / 2)],
    spreadMs: values[values.length - 1] - values[0],
    trials: results,
  };
}
