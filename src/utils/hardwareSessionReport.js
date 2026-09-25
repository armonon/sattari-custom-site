// These checks establish capture continuity, not driver-level dropout detection
// or audible quality. Hardware and musical listening remain separate sign-offs.
export function hardwareSessionReport({
  targetSeconds,
  sampleRate,
  samples,
  captured,
  recovered,
  events,
  committedEvents,
  interrupted = false,
}) {
  const failures = [];
  const last = samples.at(-1);
  if (!last || last.duration < targetSeconds - 1)
    failures.push('Target session duration was not reached.');
  if (interrupted) failures.push('Input was disconnected or the test was stopped early.');
  if (captured?.error) failures.push(captured.error);
  if (
    !samples.length ||
    samples.some((s) => s.error || s.contextState !== 'running' || s.clockLag > 1)
  )
    failures.push('Audio clock or capture health reported a fault.');
  if (samples.some((s) => s.pendingBytes >= 64 * 1048576))
    failures.push('Pending audio exceeded 64 MiB.');
  const input = captured?.tracks?.find((t) => t.replayInput === 'microphone');
  if (!input?.clips?.length) failures.push('No hardware input chunks were recorded.');
  for (const track of captured?.tracks || []) {
    const restored = recovered?.tracks?.find((t) => t.id === track.id);
    if (
      !restored ||
      restored.clips.length !== track.clips.length ||
      restored.clips.some((clip, i) => clip.assetId !== track.clips[i].assetId)
    )
      failures.push(`Recovery mismatch: ${track.name}`);
    for (let i = 1; i < track.clips.length; i++) {
      const previous = track.clips[i - 1],
        clip = track.clips[i];
      if (Math.abs(clip.start - previous.start - previous.duration) > 1 / sampleRate)
        failures.push(`Chunk gap or overlap: ${track.name}, chunk ${i + 1}`);
    }
    const recorded = track.clips.reduce((sum, clip) => sum + clip.duration, 0);
    if (last && Math.abs(recorded - last.duration) > 1)
      failures.push(`Recorded length differs from the audio clock: ${track.name}`);
  }
  if (!Number.isInteger(events) || events !== committedEvents)
    failures.push('Recorded events did not all survive recovery.');
  return {
    status: failures.length ? 'needs-review' : 'capture-checks-passed',
    failures,
    limitation:
      'Not a driver-dropout or listening certification. Inspect input audio, relaunch recovery and export before stage use.',
    targetSeconds,
    sampleRate,
    duration: last?.duration || 0,
    peakPendingMiB: Math.max(0, ...samples.map((s) => s.pendingBytes || 0)) / 1048576,
    maxClockLag: Math.max(0, ...samples.map((s) => s.clockLag || 0)),
    events,
    committedEvents,
    captureId: captured?.id,
  };
}
