// These are browser estimates, not CPU utilization or measured round-trip latency.
export function audioLatency(context) {
  const milliseconds = (value) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value * 1000 : null;
  return {
    processingMs: milliseconds(context?.baseLatency),
    outputMs: milliseconds(context?.outputLatency),
  };
}

export function callbackDelay(now, previous, interval = 400) {
  return previous == null ? null : Math.max(0, now - previous - interval);
}

export function telemetryLabel(latency, delay) {
  const display = (value) => (Number.isFinite(value) ? `${value.toFixed(1)} ms` : 'unavailable');
  return `UI callback delay: ${display(delay)}. Audio processing estimate: ${display(latency?.processingMs)}. Output device estimate: ${display(latency?.outputMs)}. Not a CPU or round-trip measurement.`;
}
