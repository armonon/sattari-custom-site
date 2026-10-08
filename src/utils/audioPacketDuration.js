// Blob is immutable. Keep only its validated packet end (not media bytes or
// pending work) so range decoders do not rescan a long source for every page.
// Failed/cancelled probes are never cached; the owning Input still disposes them.
const durations = new WeakMap();
export async function audioPacketDuration(blob, input, track) {
  if (durations.has(blob)) return durations.get(blob);
  const duration = await input.computeDuration([track]);
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error('The audio file has incomplete timing information. Convert it to PCM WAV.');
  durations.set(blob, duration);
  return duration;
}
