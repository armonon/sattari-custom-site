// Keep original clip coordinates: slicing clips here would restart their fades,
// note envelopes and automation at every streaming boundary.
export function playbackWindow(project, start, end) {
  return {
    ...project,
    tracks: project.tracks
      .filter((track) => !track.offline)
      .map((track) => ({
        ...track,
        clips: track.clips.filter(
          (clip) => !clip.disabled && clip.start < end && clip.start + clip.duration > start
        ),
      })),
  };
}

export function needsStreaming(project) {
  const assets = new Map();
  for (const track of project.tracks) {
    if (track.offline) continue;
    for (const clip of track.clips) {
      if (clip.disabled) continue;
      if (clip.start + clip.duration > 120 || clip.sourceDuration > 120) return true;
      if (clip.assetId)
        assets.set(
          clip.assetId,
          Math.max(assets.get(clip.assetId) || 0, clip.sourceDuration || clip.duration)
        );
    }
  }
  // A dense short project can be larger than a sparse long one. Estimate a
  // conservative stereo/48 kHz decode budget, counting shared assets only once.
  return (
    [...assets.values()].reduce((seconds, duration) => seconds + duration, 0) * 48000 * 8 >
    96 * 1024 * 1024
  );
}
