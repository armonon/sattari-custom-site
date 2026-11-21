const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
export function alignedBeatPosition(
  position,
  bpm,
  offset,
  referencePosition,
  referenceBpm,
  referenceOffset = 0,
  quantum = 1
) {
  if (
    ![position, bpm, offset, referencePosition, referenceBpm, referenceOffset].every(
      Number.isFinite
    ) ||
    bpm <= 0 ||
    referenceBpm <= 0 ||
    ![1, 4].includes(quantum)
  )
    throw new Error('Set valid BPM and beat-grid positions before syncing.');
  const beat = 60 / bpm;
  const phase = mod(((referencePosition - referenceOffset) * referenceBpm) / 60, quantum);
  const grid = (position - offset) / beat;
  let aligned = offset + (Math.round((grid - phase) / quantum) * quantum + phase) * beat;
  if (aligned < 0) aligned += Math.ceil(-aligned / (beat * quantum)) * beat * quantum;
  return aligned;
}
