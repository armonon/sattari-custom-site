import {
  arrangementId,
  audioClip,
  audioTrack,
  mapChanged,
  splitClip,
} from '../../utils/arrangementModel';

// Pure project operations used by the arrangement editor. Inputs are never
// mutated; unchanged tracks, clips and arrays keep their identity, and an
// operation that changes nothing returns the project it was given.

const withTracks = (project, tracks) =>
  tracks === project.tracks ? project : { ...project, tracks };
const withClips = (track, clips) => (clips === track.clips ? track : { ...track, clips });

export const appendTracks = (project, tracks) => ({
  ...project,
  tracks: [...project.tracks, ...tracks],
});

export function updateTrack(project, id, updates) {
  return withTracks(
    project,
    mapChanged(project.tracks, (track) =>
      track.id !== id ||
      Object.entries(updates).every(([key, value]) => Object.is(track[key], value))
        ? track
        : { ...track, ...updates }
    )
  );
}

export const toggleTrackOffline = (project, id) => ({
  ...project,
  tracks: project.tracks.map((row) => (row.id === id ? { ...row, offline: !row.offline } : row)),
});

export const duplicateTrack = (project, id) => ({
  ...project,
  tracks: project.tracks.flatMap((row) =>
    row.id === id
      ? [
          row,
          {
            ...row,
            id: arrangementId(),
            name: `${row.name} copy`,
            clips: row.clips.map((clip) => ({ ...clip, id: arrangementId() })),
          },
        ]
      : [row]
  ),
});

export function moveTrack(project, id, direction) {
  const index = project.tracks.findIndex((row) => row.id === id),
    target = index + direction;
  if (index < 0 || target < 0 || target >= project.tracks.length) return project;
  const tracks = [...project.tracks];
  [tracks[target], tracks[index]] = [tracks[index], tracks[target]];
  return { ...project, tracks };
}

export const deleteTrack = (project, id) => ({
  ...project,
  tracks: project.tracks.filter((row) => row.id !== id),
});

export const appendClip = (project, trackId, clip) =>
  withTracks(
    project,
    mapChanged(project.tracks, (track) =>
      track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track
    )
  );

export function removeClips(project, ids) {
  const unwanted = new Set(ids);
  return withTracks(
    project,
    mapChanged(project.tracks, (track) => {
      const clips = track.clips.filter((clip) => !unwanted.has(clip.id));
      return clips.length === track.clips.length ? track : { ...track, clips };
    })
  );
}

/** Removes a clip from every track and appends its replacement to `trackId`. */
export function replaceClip(project, trackId, clip) {
  if (!project.tracks.some((track) => track.id === trackId)) return project;
  return withTracks(
    project,
    mapChanged(project.tracks, (track) => {
      const kept = track.clips.filter((item) => item.id !== clip.id);
      if (track.id === trackId) return { ...track, clips: [...kept, clip] };
      return kept.length === track.clips.length ? track : { ...track, clips: kept };
    })
  );
}

export function dropClip(project, clipId, trackId, start) {
  const moved = project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId);
  return moved ? replaceClip(project, trackId, { ...moved, start }) : project;
}

export function splitClipAt(project, clipId, time) {
  return withTracks(
    project,
    mapChanged(project.tracks, (track) => {
      const clips = track.clips.flatMap((clip) =>
        clip.id === clipId ? splitClip(clip, time) : [clip]
      );
      return clips.length === track.clips.length ? track : { ...track, clips };
    })
  );
}

/** Pastes clipboard entries relative to their earliest start, recreating missing tracks. */
export function pasteClips(project, entries, at) {
  const first = Math.min(...entries.map(({ clip }) => clip.start));
  let tracks = project.tracks;
  for (const { trackId, clip } of entries) {
    const index = tracks.findIndex((row) => row.id === trackId);
    const created = index < 0 ? { ...audioTrack('Pasted clips'), id: trackId } : null;
    const pasted = {
      ...clip,
      patternId: undefined,
      id: arrangementId(),
      start: at + clip.start - first,
    };
    tracks = created
      ? [...tracks, { ...created, clips: [pasted] }]
      : tracks.map((row, i) => (i === index ? { ...row, clips: [...row.clips, pasted] } : row));
  }
  return { ...project, tracks };
}

export function relinkAsset(project, assetId, replacement) {
  return withTracks(
    project,
    mapChanged(project.tracks, (track) =>
      withClips(
        track,
        mapChanged(track.clips, (clip) =>
          clip.assetId !== assetId ? clip : { ...clip, ...replacement }
        )
      )
    )
  );
}

export const addLocator = (project, time) => ({
  ...project,
  locators: [
    ...(project.locators || []),
    { id: arrangementId(), name: `Marker ${(project.locators?.length || 0) + 1}`, time },
  ],
});

export const renameLocator = (project, id, name) => ({
  ...project,
  locators: project.locators.map((row) => (row.id === id ? { ...row, name } : row)),
});

export const deleteLocator = (project, id) => ({
  ...project,
  locators: project.locators.filter((row) => row.id !== id),
});

export const replaceCapture = (project, index, capture) => ({
  ...project,
  captures: project.captures.map((item, i) => (i === index ? capture : item)),
});

/** Adds a journaled take's events plus its muted, offline source lanes. */
export function recoverEvents(project, take, recoveries) {
  if (project.captures.some((row) => row.id === take.id)) return project;
  const sources = recoveries.find((row) => row.id === take.sourceCaptureId);
  const tracks = [...project.tracks];
  for (const track of sources?.tracks || [])
    if (!tracks.some((row) => row.id === track.id))
      tracks.push({ ...track, muted: true, offline: true });
  return {
    ...project,
    captures: [...project.captures, { ...take, originalEvents: structuredClone(take.events) }],
    tracks,
  };
}

/** Merges recovered source lanes; clips already present are kept once. */
export function recoverSourceTake(project, take) {
  let tracks = project.tracks;
  for (const row of take.tracks) {
    const index = tracks.findIndex((track) => track.id === row.id);
    if (index < 0) {
      tracks = [...tracks, { ...row, muted: true, offline: true }];
      continue;
    }
    const existing = tracks[index],
      ids = new Set(existing.clips.map((clip) => clip.id));
    const clips = [...existing.clips, ...row.clips.filter((clip) => !ids.has(clip.id))];
    tracks = tracks.map((track, i) => (i === index ? { ...existing, clips } : track));
  }
  return { ...project, tracks };
}

/** The project with one clip's waveform set; unchanged if the clip is gone. */
export function withClipWaveform(project, clipId, waveform) {
  let found = false;
  const tracks = project.tracks.map((track) => {
    if (!track.clips.some((clip) => clip.id === clipId)) return track;
    found = true;
    return {
      ...track,
      clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, waveform } : clip)),
    };
  });
  return found ? { ...project, tracks } : project;
}

/** New reference lane for a recorded take; earlier references are muted. */
export const addReferenceTake = (project, track) => ({
  ...project,
  tracks: [
    ...project.tracks.map((row) => (row.role === 'reference' ? { ...row, muted: true } : row)),
    track,
  ],
});

/** Printed replay output as muted comparison lanes aligned to the capture. */
export function printedPerformanceTracks(sources, capture, offset) {
  return sources.tracks
    .filter((track) => track.role === 'reference')
    .map((row) => {
      const clips = row.clips.flatMap((clip) => {
        const start = clip.start - offset,
          trim = Math.max(0, -start);
        const duration = Math.min(clip.duration - trim, capture.duration - Math.max(0, start));
        return duration > 0
          ? [
              {
                ...clip,
                start: Math.max(0, start) + (capture.timelineStart || 0),
                offset: (clip.offset || 0) + trim,
                duration,
              },
            ]
          : [];
      });
      return {
        ...row,
        name: `${capture.name} · edited performance`,
        muted: true,
        offline: false,
        clips,
      };
    });
}

export function instrumentTrack(instrument, bpm, at) {
  const track = audioTrack(instrument === 'drums' ? 'Drums' : 'Instrument');
  track.kind = 'midi';
  track.clips.push({
    ...audioClip('', instrument === 'drums' ? 'Beat pattern' : 'Instrument pattern', 240 / bpm, at),
    kind: 'midi',
    timebase: 'beats',
    instrument,
    notes: [],
  });
  return track;
}

/** An empty pattern that inherits the track's first instrument. */
export function instrumentPattern(track, bpm, at) {
  const template = track?.clips.find((clip) => clip.kind === 'midi');
  return {
    ...audioClip('', 'Instrument pattern', 240 / bpm, Math.max(0, at)),
    kind: 'midi',
    timebase: 'beats',
    instrument: template?.instrument || 'piano',
    assetId: template?.assetId || '',
    sampleRoot: template?.sampleRoot || 'C4',
    instrumentSettings: structuredClone(template?.instrumentSettings || {}),
    notes: [],
  };
}

/** A recorded MIDI take on its own lane, keeping the sound it was played with. */
export function midiTakeTrack(notes, duration, start, sound) {
  const source = sound?.clip;
  const track = {
    ...audioTrack('MIDI take'),
    gain: sound?.track?.gain ?? 100,
    pan: sound?.track?.pan ?? 0,
    effects: structuredClone(sound?.track?.effects || []),
    stemRole: sound?.track?.stemRole || 'unseparated',
  };
  track.kind = 'midi';
  track.clips.push({
    ...audioClip(
      source?.instrument === 'sampler' ? source.assetId : '',
      'MIDI take',
      Math.max(0.01, duration),
      start
    ),
    kind: 'midi',
    timebase: 'beats',
    instrument: source?.instrument || sound?.instrument || 'triangle',
    sampleRoot: source?.sampleRoot || 'C4',
    instrumentSettings: structuredClone(source?.instrumentSettings || {}),
    gain: source?.gain ?? 100,
    notes,
  });
  return track;
}
