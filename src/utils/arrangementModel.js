import { validateEffects, rackTail, EFFECTS } from './arrangementEffects';

export const arrangementId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
export const bounded = (value, min, max, fallback = min) =>
  Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
export const linearGain = (value = 100) => bounded(value, 0, 300, 100) / 100;
// Thin out grid lines by musical subdivisions at low zoom; a fixed pixel
// minimum would drift away from the beat ruler.
export function arrangementGridPixels(bpm, division, zoom) {
  const step =
    (60 / bounded(bpm, 20, 300, 120) / bounded(division, 1, 32, 4)) * bounded(zoom, 0.1, 1000, 40);
  return step * 2 ** Math.max(0, Math.ceil(Math.log2(8 / step)));
}
export const emptyArrangement = () => ({ version: 1, tracks: [], captures: [] });
export const audioTrack = (name = 'Audio track') => ({
  id: arrangementId(),
  name,
  kind: 'audio',
  gain: 100,
  pan: 0,
  muted: false,
  solo: false,
  clips: [],
});
export const audioClip = (assetId, name, duration, start = 0) => ({
  id: arrangementId(),
  kind: 'audio',
  assetId,
  name,
  start,
  offset: 0,
  duration,
  sourceDuration: duration,
  rate: 1,
  gain: 100,
  fadeIn: 0.005,
  fadeOut: 0.005,
  automation: { volume: [], pan: [], filter: [] },
});

const patternFields = (clip) => ({
  notes: structuredClone(clip.notes),
  instrument: clip.instrument || 'triangle',
  assetId: clip.assetId || '',
  sampleRoot: clip.sampleRoot || 'C4',
  instrumentSettings: structuredClone(clip.instrumentSettings || {}),
  duration: clip.duration,
  timebase: clip.timebase || 'seconds',
  ...(clip.trimSource
    ? { trimSource: structuredClone(clip.trimSource), trimOffset: clip.trimOffset }
    : {}),
});

// Definitions own musical content; materialized clips keep old project readers compatible.
export function repeatLinkedPattern(project, clipId) {
  const next = structuredClone(project);
  const track = next.tracks.find((row) => row.clips.some((clip) => clip.id === clipId));
  const source = track?.clips.find((clip) => clip.id === clipId);
  if (source?.kind !== 'midi') throw new Error('Select an instrument pattern first.');
  const id = source.patternId || arrangementId();
  source.patternId = id;
  next.patterns = { ...next.patterns, [id]: patternFields(source) };
  const repeat = {
    ...structuredClone(source),
    id: arrangementId(),
    start: source.start + source.duration,
  };
  track.clips.push(repeat);
  return next;
}

export function updatePatternClip(project, clipId, updates) {
  const selected = project.tracks
    .flatMap((track) => track.clips)
    .find((clip) => clip.id === clipId);
  if (!selected) return project;
  updates = preserveTrimEdits(selected, updates);
  const detach =
    'duration' in updates ||
    'timebase' in updates ||
    ('patternId' in updates && !updates.patternId);
  const shared =
    !detach &&
    ['notes', 'instrument', 'assetId', 'sampleRoot', 'instrumentSettings'].some(
      (key) => key in updates
    );
  const patternId = selected.patternId;
  const content = shared && patternId ? patternFields({ ...selected, ...updates }) : null;
  return {
    ...project,
    ...(content ? { patterns: { ...project.patterns, [patternId]: content } } : {}),
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        const own = clip.id === clipId;
        const linked = content && clip.patternId === patternId;
        return own || linked
          ? {
              ...clip,
              ...(linked ? content : {}),
              ...(own ? updates : {}),
              ...(own && ('duration' in updates || 'timebase' in updates)
                ? { patternId: undefined }
                : {}),
            }
          : clip;
      }),
    })),
  };
}

// Clip-local envelopes are sliced with interpolated boundary values, not merely
// filtered: trimming in the middle of a ramp must preserve what was audible.
export function cropEnvelope(points, start, end, fallback = 1) {
  if (!points?.length) return [];
  return [
    { time: 0, value: automationAt(points, start, fallback) },
    ...points
      .filter((p) => p.time > start && p.time < end)
      .map((p) => ({ ...p, time: p.time - start })),
    { time: end - start, value: automationAt(points, end, fallback) },
  ];
}

// Trimming changes a window onto musical content, not the content itself.
// Visible notes/envelopes stay materialized for older readers and the editor.
function trimSource(clip) {
  return (
    clip.trimSource || {
      duration: clip.duration,
      offset: clip.offset,
      notes: clip.notes?.map((note) => ({ ...note, id: note.id || arrangementId() })),
      automation: structuredClone(clip.automation),
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut,
      fadeInCurve: clip.fadeInCurve,
      fadeOutCurve: clip.fadeOutCurve,
    }
  );
}

function preserveTrimEdits(clip, updates) {
  if (!clip.trimSource || 'trimSource' in updates) return updates;
  const source = structuredClone(clip.trimSource),
    from = clip.trimOffset || 0;
  const end = from + clip.duration;
  source.duration = Math.max(source.duration, end);
  if ('notes' in updates) {
    const seen = new Set();
    updates = {
      ...updates,
      notes: updates.notes.map((note) => {
        const id = !note.id || seen.has(note.id) ? arrangementId() : note.id;
        seen.add(id);
        return { ...note, id };
      }),
    };
    const visible = new Map(clip.notes.map((note) => [note.id, note]));
    const edited = new Map(updates.notes.filter((note) => note.id).map((note) => [note.id, note]));
    source.notes = source.notes.flatMap((note) => {
      if (!visible.has(note.id)) return [note];
      const next = edited.get(note.id),
        before = visible.get(note.id);
      if (!next) return [];
      edited.delete(note.id);
      if (JSON.stringify(next) === JSON.stringify(before)) return [note];
      return [
        {
          ...next,
          time: next.time === before.time ? note.time : next.time + from,
          duration:
            next.duration === before.duration && next.time === before.time
              ? note.duration
              : next.duration,
        },
      ];
    });
    source.notes.push(
      ...updates.notes
        .filter((note) => !note.id || edited.has(note.id))
        .map((note) => ({ ...note, id: arrangementId(), time: note.time + from }))
    );
  }
  if ('automation' in updates) {
    for (const [key, points] of Object.entries(updates.automation)) {
      if (JSON.stringify(points) === JSON.stringify(clip.automation[key])) continue;
      source.automation[key] = [
        ...(source.automation[key] || []).filter((point) => point.time < from || point.time > end),
        ...points.map((point) => ({ ...point, time: point.time + from })),
      ].sort((a, b) => a.time - b.time);
    }
  }
  for (const key of ['fadeIn', 'fadeOut', 'fadeInCurve', 'fadeOutCurve'])
    if (key in updates) source[key] = updates[key];
  return { ...updates, trimSource: source };
}

export function resizeClip(clip, requestedDuration) {
  const available =
    clip.kind === 'audio' && Number.isFinite(clip.sourceDuration)
      ? Math.max(0.001, (clip.sourceDuration - clip.offset) / clip.rate)
      : 86400;
  const duration = bounded(requestedDuration, 0.001, available);
  const source = trimSource(clip),
    from = clip.trimOffset || 0;
  const next = {
    ...clip,
    ...(duration !== clip.duration ? { patternId: undefined } : {}),
    duration,
    trimSource: source,
    trimOffset: from,
    fadeIn: Math.min(source.fadeIn, duration),
    fadeOut: Math.min(source.fadeOut, duration),
    automation: Object.fromEntries(
      Object.entries(source.automation).map(([key, points]) => [
        key,
        cropEnvelope(
          points,
          from,
          from + duration,
          key === 'volume' ? 100 : key === 'pan' ? 0 : 20000
        ),
      ])
    ),
  };
  for (const key of ['fadeInCurve', 'fadeOutCurve'])
    if (source[key]) next[key] = cropEnvelope(source[key], from, from + duration);
  if (clip.kind === 'midi')
    next.notes = source.notes
      .filter((note) => note.time < from + duration && note.time + note.duration > from)
      .map((note) => ({
        ...note,
        time: Math.max(0, note.time - from),
        duration: Math.min(note.time + note.duration, from + duration) - Math.max(note.time, from),
      }))
      .filter((note) => note.duration >= 0.001);
  return next;
}

export function trimClipStart(clip, timelineTime) {
  const source = trimSource(clip),
    from = clip.trimOffset || 0;
  const delta = bounded(
    timelineTime - clip.start,
    -Math.min(from, clip.start),
    clip.duration - 0.002
  );
  if (Math.abs(delta) < 0.001) return clip;
  if (!source.fadeInCurve)
    source.fadeInCurve = source.fadeIn
      ? [
          { time: 0, value: 0 },
          { time: source.fadeIn, value: 1 },
        ]
      : [{ time: 0, value: 1 }];
  return resizeClip(
    {
      ...clip,
      trimSource: source,
      trimOffset: from + delta,
      start: clip.start + delta,
      offset: clip.offset + delta * clip.rate,
    },
    clip.duration - delta
  );
}

export function clipRows(clips) {
  const ends = [],
    rows = new Map();
  for (const clip of [...clips].sort((a, b) => a.start - b.start)) {
    let row = ends.findIndex((end) => end <= clip.start + 0.00001);
    if (row < 0) row = ends.length;
    ends[row] = clip.start + clip.duration;
    rows.set(clip.id, row);
  }
  return { rows, count: Math.max(1, ends.length) };
}

export function moveClips(project, ids, delta, sourceTrackId, destinationTrackId) {
  const wanted = new Set(ids),
    moved = project.tracks.flatMap((track, index) =>
      track.clips.filter((clip) => wanted.has(clip.id)).map((clip) => ({ clip, index }))
    );
  if (!moved.length) return project;
  const from = project.tracks.findIndex((track) => track.id === sourceTrackId);
  const to = project.tracks.findIndex((track) => track.id === destinationTrackId);
  const shift = bounded(
    to - from,
    -Math.min(...moved.map((item) => item.index)),
    project.tracks.length - 1 - Math.max(...moved.map((item) => item.index))
  );
  const time = bounded(
    delta,
    -Math.min(...moved.map(({ clip }) => clip.start)),
    86400 - Math.max(...moved.map(({ clip }) => clip.start))
  );
  const tracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((clip) => !wanted.has(clip.id)),
  }));
  for (const { clip, index } of moved)
    tracks[index + shift].clips.push({ ...clip, start: clip.start + time });
  return { ...project, tracks };
}

export function clipWaveform(clip) {
  if (!clip.waveform?.length) return [];
  const source = clip.sourceDuration || clip.offset + clip.duration * clip.rate;
  const start = bounded(clip.offset / source, 0, 1),
    end = bounded((clip.offset + clip.duration * clip.rate) / source, start, 1);
  const samples = clip.waveform;
  const length = Math.min(256, samples.length);
  return Array.from({ length }, (_, i) => {
    const index = (start + ((end - start) * i) / Math.max(1, length - 1)) * (samples.length - 1);
    const left = Math.floor(index),
      fraction = index - left;
    return (
      samples[left] * (1 - fraction) + samples[Math.min(samples.length - 1, left + 1)] * fraction
    );
  });
}

export function retimeMidi(project, oldBpm, newBpm) {
  const ratio = oldBpm / newBpm;
  const scale = (points) => points?.map((point) => ({ ...point, time: point.time * ratio }));
  const result = {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) =>
        clip.kind !== 'midi' || clip.timebase !== 'beats'
          ? clip
          : {
              ...clip,
              start: clip.start * ratio,
              offset: clip.offset * ratio,
              duration: clip.duration * ratio,
              fadeIn: clip.fadeIn * ratio,
              fadeOut: clip.fadeOut * ratio,
              fadeInCurve: scale(clip.fadeInCurve),
              fadeOutCurve: scale(clip.fadeOutCurve),
              ...(clip.trimSource
                ? {
                    trimOffset: (clip.trimOffset || 0) * ratio,
                    trimSource: {
                      ...clip.trimSource,
                      offset: clip.trimSource.offset * ratio,
                      duration: clip.trimSource.duration * ratio,
                      fadeIn: clip.trimSource.fadeIn * ratio,
                      fadeOut: clip.trimSource.fadeOut * ratio,
                      fadeInCurve: scale(clip.trimSource.fadeInCurve),
                      fadeOutCurve: scale(clip.trimSource.fadeOutCurve),
                      notes: clip.trimSource.notes?.map((note) => ({
                        ...note,
                        time: note.time * ratio,
                        duration: note.duration * ratio,
                      })),
                      automation: Object.fromEntries(
                        Object.entries(clip.trimSource.automation).map(([key, points]) => [
                          key,
                          scale(points),
                        ])
                      ),
                    },
                  }
                : {}),
              notes: clip.notes.map((note) => ({
                ...note,
                time: note.time * ratio,
                duration: note.duration * ratio,
              })),
              automation: Object.fromEntries(
                Object.entries(clip.automation).map(([key, points]) => [key, scale(points)])
              ),
            }
      ),
    })),
  };
  if (result.patterns) {
    result.patterns = { ...result.patterns };
    for (const clip of result.tracks.flatMap((track) => track.clips))
      if (clip.patternId) result.patterns[clip.patternId] = patternFields(clip);
  }
  return result;
}

// Points are in clip-local seconds, not viewport coordinates.
export function automationAt(points = [], time, fallback = 100) {
  if (!points.length) return fallback;
  const sorted = [...points].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  const index = sorted.findIndex((point) => point.time > time);
  if (index < 0) return sorted[sorted.length - 1].value;
  const left = sorted[index - 1],
    right = sorted[index];
  return left.value + ((right.value - left.value) * (time - left.time)) / (right.time - left.time);
}

export function splitClip(clip, timelineTime) {
  const at = timelineTime - clip.start;
  if (at <= 0.001 || at >= clip.duration - 0.001) return [clip];
  // A split creates independent content; subsequent trims remain reversible.
  clip = { ...clip, trimSource: undefined, trimOffset: undefined };
  const left = { ...clip, patternId: undefined, duration: at, fadeOut: 0 },
    right = {
      ...clip,
      patternId: undefined,
      id: arrangementId(),
      start: timelineTime,
      offset: (clip.offset || 0) + at * (clip.rate || 1),
      duration: clip.duration - at,
      fadeIn: 0,
    };
  left.fadeIn = Math.min(clip.fadeIn || 0, at);
  right.fadeOut = Math.min(clip.fadeOut || 0, right.duration);
  left.automation = {};
  right.automation = {};
  const divideCurve = (points) => {
    const value = automationAt(points, at, 1);
    return [
      [...points.filter((point) => point.time < at), { time: at, value }],
      [
        { time: 0, value },
        ...points
          .filter((point) => point.time > at)
          .map((point) => ({ ...point, time: point.time - at })),
      ],
    ];
  };
  // Splitting inside a fade must not restart it or change its slope.
  [left.fadeInCurve, right.fadeInCurve] = divideCurve(
    clip.fadeInCurve ||
      (clip.fadeIn
        ? [
            { time: 0, value: 0 },
            { time: clip.fadeIn, value: 1 },
          ]
        : [{ time: 0, value: 1 }])
  );
  [left.fadeOutCurve, right.fadeOutCurve] = divideCurve(
    clip.fadeOutCurve ||
      (clip.fadeOut
        ? [
            { time: Math.max(0, clip.duration - clip.fadeOut), value: 1 },
            { time: clip.duration, value: 0 },
          ]
        : [{ time: 0, value: 1 }])
  );
  for (const [target, points] of Object.entries(clip.automation || {})) {
    if (!points.length) {
      left.automation[target] = [];
      right.automation[target] = [];
      continue;
    }
    const value = automationAt(points, at);
    left.automation[target] = [...points.filter((point) => point.time < at), { time: at, value }];
    right.automation[target] = [
      { time: 0, value },
      ...points
        .filter((point) => point.time > at)
        .map((point) => ({ ...point, time: point.time - at })),
    ];
  }
  if (clip.kind === 'midi') {
    const notes = clip.notes || [];
    left.notes = notes
      .filter((note) => note.time < at)
      .map((note) => ({ ...note, duration: Math.min(note.duration, at - note.time) }))
      .filter((note) => note.duration >= 0.001);
    right.notes = notes
      .filter((note) => note.time + note.duration > at)
      .map((note) => ({
        ...note,
        time: Math.max(0, note.time - at),
        duration: note.duration - Math.max(0, at - note.time),
      }))
      .filter((note) => note.duration >= 0.001);
  }
  return [left, right];
}

export function arrangementDuration(project) {
  return project.tracks.reduce(
    (end, track) =>
      track.clips.reduce(
        (value, clip) =>
          Math.max(value, clip.start + clip.duration + rackTail(track.effects, track.automation)),
        end
      ),
    0
  );
}

export function arrangementRange(project, start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end - start < 0.001)
    throw new Error('Choose an export range with an end after its start.');
  return {
    ...project,
    captures: [],
    tracks: project.tracks.map((track) => ({
      ...track,
      ...(track.automation
        ? {
            automation: Object.fromEntries(
              Object.entries(track.automation).map(([target, points]) => [
                target,
                cropEnvelope(points, start, end, points[0]?.value || 0),
              ])
            ),
          }
        : {}),
      clips: track.clips.flatMap((original) => {
        if (original.start >= end || original.start + original.duration <= start) return [];
        let clip = original;
        if (clip.start < start) clip = splitClip(clip, start)[1];
        if (!clip) return [];
        if (clip.start + clip.duration > end) clip = splitClip(clip, end)[0];
        return [{ ...clip, id: original.id, start: Math.max(0, clip.start - start) }];
      }),
    })),
  };
}

export function arrangementSchedule(project, cursor = 0) {
  const solo = project.tracks.some((track) => track.solo);
  return project.tracks.flatMap((track) =>
    track.offline || track.muted || (solo && !track.solo)
      ? []
      : track.clips.flatMap((clip) => {
          const elapsed = Math.max(0, cursor - clip.start);
          if (elapsed >= clip.duration || clip.disabled) return [];
          return [
            {
              track,
              clip,
              elapsed,
              delay: Math.max(0, clip.start - cursor),
              duration: clip.duration - elapsed,
              offset: (clip.offset || 0) + elapsed * (clip.rate || 1),
            },
          ];
        })
  );
}

// Replace only the chosen region on a comp lane. Source clips and their assets
// remain unchanged, allowing another take to replace the region later.
export function compRegion(project, sourceId, start, end) {
  const source = project.tracks.find((track) => track.id === sourceId);
  if (
    !source ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end - start < 0.002
  )
    throw new Error('Choose a valid source track and comp range.');
  const role = source.role === 'reference' ? 'reference' : 'comp';
  const hasBus = (track) => track.effects?.length || Object.keys(track.automation || {}).length;
  // Different processing needs a different bus. Reusing a single lane would
  // either drop the new take's FX or change every previously chosen region.
  const processingKey = (track) =>
    JSON.stringify([
      track.kind,
      track.stemRole || 'unseparated',
      track.effects || [],
      hasBus(track) ? track.gain : 100,
      track.automation || {},
    ]);
  let destination = project.tracks.find(
    (track) =>
      track.compLane &&
      track.role === role &&
      track.id !== sourceId &&
      processingKey(track) === processingKey(source)
  );
  const selection = arrangementRange({ ...project, tracks: [source] }, start, end).tracks[0].clips;
  if (!selection.length) throw new Error('No source audio or notes in this range.');
  if (!destination)
    destination = {
      ...audioTrack(role === 'reference' ? 'Comp · printed takes' : 'Comp · source takes'),
      role,
      compLane: true,
      kind: source.kind,
      stemRole: source.stemRole || 'unseparated',
      effects: structuredClone(source.effects || []),
      gain: hasBus(source) ? source.gain : 100,
      automation: structuredClone(source.automation || {}),
    };
  const outside = (clips) =>
    clips.flatMap((clip) => {
      if (clip.start >= end || clip.start + clip.duration <= start) return [clip];
      const pieces = [];
      if (clip.start < start - 0.001) pieces.push(splitClip(clip, start)[0]);
      if (clip.start + clip.duration > end + 0.001) pieces.push(splitClip(clip, end)[1]);
      return pieces.filter(Boolean);
    });
  const clips = selection.map((clip) => ({
    ...clip,
    id: arrangementId(),
    start: clip.start + start,
    mixGain: (clip.mixGain ?? 1) * (hasBus(source) ? 1 : linearGain(source.gain)),
    automation: {
      ...clip.automation,
      pan:
        clip.automation.pan?.length || source.automation?.pan?.length
          ? clip.automation.pan
          : [{ time: 0, value: source.pan }],
    },
  }));
  const result = {
    ...project,
    tracks: project.tracks
      .filter((track) => track.id !== destination.id)
      .map((track) =>
        track.id === sourceId
          ? { ...track, muted: true, solo: false }
          : track.compLane && track.role === role
            ? { ...track, clips: outside(track.clips) }
            : track
      ),
  };
  result.tracks.push({
    ...destination,
    clips: [...outside(destination.clips), ...clips].sort((a, b) => a.start - b.start),
    muted: false,
  });
  validateArrangement(result);
  return result;
}

export function rulerMarks(duration, bpm, pixelsPerSecond = 40, viewport = null) {
  const bar = 240 / bounded(bpm, 20, 300, 120);
  const stride = Math.max(1, Math.pow(2, Math.ceil(Math.log2(70 / (bar * pixelsPerSecond)))));
  const first = viewport
    ? Math.max(0, Math.floor(viewport.left / pixelsPerSecond / (bar * stride)))
    : 0;
  const last = Math.min(
    Math.floor(duration / (bar * stride)),
    viewport
      ? Math.ceil((viewport.left + viewport.width) / pixelsPerSecond / (bar * stride))
      : Infinity
  );
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) => ({
    time: (first + offset) * stride * bar,
    label: `${(first + offset) * stride + 1}`,
  }));
}

export function migrateArrangement(project) {
  if (project.arranger) {
    validateArrangement(project.arranger);
    return project.arranger;
  }
  const result = emptyArrangement();
  for (const deck of project.decks || []) {
    if (!deck?.duration) continue;
    const edit = deck.arrangement || {};
    if (edit.enabled === false) continue;
    const offset = bounded(edit.trimStart || 0, 0, deck.duration);
    const duration = Math.max(0, Math.min(edit.trimEnd ?? deck.duration, deck.duration) - offset);
    const lanes = Object.entries(deck.lanes || {}).filter(([, lane]) => lane.assetId);
    const solo = lanes.some(([, lane]) => lane.solo);
    for (const [laneId, lane] of lanes) {
      if (lane.muted || (solo && !lane.solo) || !duration) continue;
      const track = audioTrack(`${deck.title || deck.id} · ${laneId}`);
      track.stemRole =
        laneId === 'music'
          ? 'other'
          : ['vocals', 'drums', 'bass', 'other'].includes(laneId)
            ? laneId
            : 'unseparated';
      track.muted = !!deck.muted;
      track.solo = !!deck.solo;
      const clip = audioClip(lane.assetId, lane.name || deck.title, duration, edit.start || 0);
      Object.assign(clip, {
        offset,
        sourceDuration: deck.duration,
        gain: bounded(((edit.gain ?? 100) * (lane.level ?? 100)) / 100, 0, 300),
        fadeIn: Math.min(edit.fadeIn || 0, duration),
        fadeOut: Math.min(edit.fadeOut || 0, duration),
      });
      for (const [target, points] of Object.entries(edit.automation || {})) {
        if (target === 'volume')
          clip.automation.volume = points.map((point) => ({
            time: point.position * duration,
            value: point.value,
          }));
        if (target === 'filter')
          clip.automation.filter = points.map((point) => ({
            time: point.position * duration,
            value: 70 * Math.pow(20000 / 70, bounded(point.value, 0, 50) / 50),
          }));
      }
      track.clips.push(clip);
      result.tracks.push(track);
    }
  }
  if (project.pianoNotes?.length) {
    const track = audioTrack('Piano pattern');
    track.kind = 'midi';
    const beat = 60 / (project.master?.bpm || project.masterBpm || 120);
    track.clips.push({
      ...audioClip('', 'Piano pattern', beat * 4),
      kind: 'midi',
      notes: project.pianoNotes.map((note) => ({
        pitch: note.pitch,
        time: (note.step * beat) / 4,
        duration: beat / 4,
        velocity: bounded(
          (note.velocity ?? 0.7) > 1 ? note.velocity / 127 : (note.velocity ?? 0.7),
          0,
          1
        ),
      })),
    });
    result.tracks.push(track);
  }
  return result;
}

export function validateArrangement(project) {
  const fail = () => {
    throw new Error('Project contains invalid arrangement data.');
  };
  const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  if (
    !project ||
    project.version !== 1 ||
    !Array.isArray(project.tracks) ||
    !Array.isArray(project.captures)
  )
    fail();
  const ids = new Set();
  if (
    project.locators != null &&
    (!Array.isArray(project.locators) ||
      project.locators.some(
        (marker) =>
          !marker ||
          typeof marker.id !== 'string' ||
          typeof marker.name !== 'string' ||
          !finite(marker.time, 0, 86400)
      ))
  )
    fail();
  for (const track of project.tracks) {
    validateEffects(track?.effects);
    for (const [target, points] of Object.entries(track?.automation || {})) {
      let range = target === 'volume' ? [0, 300] : target === 'pan' ? [-1, 1] : null;
      if (target.startsWith('fx:')) {
        const [, id, key] = target.split(':');
        const effect = track.effects?.find((item) => item.id === id);
        const spec = effect && EFFECTS[effect.type]?.params[key];
        if (spec) range = [spec.min, spec.max];
      }
      if (
        !range ||
        !Array.isArray(points) ||
        points.some(
          (point) => !point || !finite(point.time, 0, 86400) || !finite(point.value, ...range)
        )
      )
        fail();
    }
    if (
      track?.stemRole != null &&
      !['vocals', 'drums', 'bass', 'other', 'unseparated'].includes(track.stemRole)
    )
      fail();
    if (
      !track ||
      typeof track.id !== 'string' ||
      ids.has(track.id) ||
      typeof track.name !== 'string' ||
      !['audio', 'midi'].includes(track.kind) ||
      !Array.isArray(track.clips) ||
      !finite(track.gain, 0, 300) ||
      !finite(track.pan, -1, 1)
    )
      fail();
    ids.add(track.id);
    for (const clip of track.clips) {
      if (
        !clip ||
        typeof clip.id !== 'string' ||
        ids.has(clip.id) ||
        typeof clip.name !== 'string' ||
        !['audio', 'midi'].includes(clip.kind) ||
        !finite(clip.start, 0, 86400) ||
        !finite(clip.duration, 0.001, 86400) ||
        !finite(clip.gain, 0, 300) ||
        !finite(clip.offset, 0, 86400) ||
        !finite(clip.rate, 0.25, 4) ||
        !finite(clip.fadeIn, 0, clip.duration) ||
        !finite(clip.fadeOut, 0, clip.duration)
      )
        fail();
      ids.add(clip.id);
      if (clip.trimSource != null) {
        const source = clip.trimSource;
        if (!finite(clip.trimOffset, 0, 86400) || !finite(source.duration, 0.001, 86400)) fail();
        validateArrangement({
          ...emptyArrangement(),
          tracks: [
            {
              ...audioTrack(),
              clips: [
                {
                  ...clip,
                  ...source,
                  duration: Math.max(source.duration, clip.trimOffset + clip.duration),
                  trimSource: undefined,
                  trimOffset: undefined,
                  patternId: undefined,
                },
              ],
            },
          ],
        });
      }
      if (clip.mixGain != null && !finite(clip.mixGain, 0, 81)) fail();
      if (clip.instrumentSettings != null) {
        if (typeof clip.instrumentSettings !== 'object') fail();
        for (const [key, value] of Object.entries(clip.instrumentSettings)) {
          const range = { attack: [0.001, 4], release: [0.005, 2], cutoff: [40, 20000] }[key];
          if (!range || !finite(value, ...range)) fail();
        }
      }
      if (
        clip.patternId != null &&
        (clip.kind !== 'midi' ||
          typeof clip.patternId !== 'string' ||
          !project.patterns?.[clip.patternId])
      )
        fail();
      if (
        clip.kind === 'midi' &&
        clip.instrument === 'sampler' &&
        (typeof clip.assetId !== 'string' ||
          !clip.assetId ||
          !/^[A-G]#?[0-8]$/.test(clip.sampleRoot || 'C4'))
      )
        fail();
      for (const key of ['fadeInCurve', 'fadeOutCurve'])
        if (
          clip[key] != null &&
          (!Array.isArray(clip[key]) ||
            clip[key].some(
              (point) =>
                !point || !finite(point.time, 0, clip.duration) || !finite(point.value, 0, 1)
            ))
        )
          fail();
      if (clip.kind === 'audio' && (typeof clip.assetId !== 'string' || !clip.assetId)) fail();
      if (clip.automation == null || typeof clip.automation !== 'object') fail();
      for (const [target, points] of Object.entries(clip.automation)) {
        if (!['volume', 'pan', 'filter'].includes(target) || !Array.isArray(points)) fail();
        const range = target === 'pan' ? [-1, 1] : target === 'filter' ? [20, 20000] : [0, 300];
        if (
          points.some(
            (point) =>
              !point || !finite(point.time, 0, clip.duration) || !finite(point.value, ...range)
          )
        )
          fail();
      }
      if (
        clip.kind === 'midi' &&
        (!Array.isArray(clip.notes) ||
          clip.notes.some(
            (note) =>
              !note ||
              !/^[A-G]#?[0-8]$/.test(note.pitch) ||
              !finite(note.time, 0, clip.duration) ||
              !finite(note.duration, 0.001, clip.duration) ||
              !finite(note.velocity, 0, 1)
          ))
      )
        fail();
    }
  }
  for (const capture of project.captures) {
    if (!capture || typeof capture.assetId !== 'string' || !Array.isArray(capture.events)) fail();
    if (capture.duration !== undefined && !finite(capture.duration, 0, 86400)) fail();
    if (capture.timelineStart !== undefined && !finite(capture.timelineStart, 0, 86400)) fail();
    if (capture.originalEvents !== undefined && !Array.isArray(capture.originalEvents)) fail();
    for (const event of [...capture.events, ...(capture.originalEvents || [])])
      if (
        !event ||
        !finite(event.time, 0, 86400) ||
        typeof event.type !== 'string' ||
        !Array.isArray(event.args) ||
        (event.scheduledTime != null && !finite(event.scheduledTime, 0, 86401)) ||
        (event.sampleRate != null && !finite(event.sampleRate, 8000, 384000)) ||
        (event.frame != null && (!Number.isSafeInteger(event.frame) || event.frame < 0)) ||
        (event.scheduledFrame != null &&
          (!Number.isSafeInteger(event.scheduledFrame) || event.scheduledFrame < 0)) ||
        (event.disabled !== undefined && typeof event.disabled !== 'boolean')
      )
        fail();
  }
  return project;
}
