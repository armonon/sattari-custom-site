const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteNumber = (pitch) => {
  const match = /^([A-G]#?)([0-8])$/.exec(pitch);
  return match ? names.indexOf(match[1]) + Number(match[2]) * 12 : -1;
};
export const notePitch = (number) => `${names[number % 12]}${Math.floor(number / 12)}`;

export function snapPitch(pitch, root, scale = 'major', direction = 0) {
  if (root === 'off') return pitch;
  const allowed = scale === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const value = noteNumber(pitch);
  for (let delta = 0; delta < 12; delta++)
    for (const candidate of [value - delta, value + delta])
      if ((direction > 0 && candidate < value) || (direction < 0 && candidate > value)) continue;
      else if (
        candidate >= 0 &&
        candidate <= 107 &&
        allowed.includes((candidate - Number(root) + 120) % 12)
      )
        return notePitch(candidate);
  return pitch;
}

export function notesInBox(notes, start, end, low, high) {
  return notes.flatMap((note, index) =>
    note.time <= end &&
    note.time + note.duration >= start &&
    noteNumber(note.pitch) >= low &&
    noteNumber(note.pitch) <= high
      ? [index]
      : []
  );
}

export function ghostNotes(project, selected) {
  return project.tracks.flatMap((track) =>
    track.clips.flatMap((clip) =>
      clip.kind !== 'midi' || clip.id === selected.id
        ? []
        : clip.notes.flatMap((note) => {
            const time = clip.start + note.time - selected.start;
            const end = Math.min(selected.duration, time + note.duration);
            return end > 0 && time < selected.duration
              ? [{ ...note, time: Math.max(0, time), duration: end - Math.max(0, time) }]
              : [];
          })
    )
  );
}

// One constrained delta for the entire selection preserves chords at clip edges.
export function moveNotes(notes, selection, seconds, semitones, duration) {
  const selected = notes.filter((_, index) => selection.includes(index));
  if (!selected.length) return notes;
  let minTime = Infinity,
    maxEnd = 0,
    low = 107,
    high = 0;
  for (const note of selected) {
    minTime = Math.min(minTime, note.time);
    maxEnd = Math.max(maxEnd, note.time + note.duration);
    low = Math.min(low, noteNumber(note.pitch));
    high = Math.max(high, noteNumber(note.pitch));
  }
  const dt = Math.max(-minTime, Math.min(duration - maxEnd, seconds));
  const dp = Math.max(-low, Math.min(107 - high, semitones));
  return notes.map((note, index) =>
    selection.includes(index)
      ? { ...note, time: note.time + dt, pitch: notePitch(noteNumber(note.pitch) + dp) }
      : note
  );
}

export function quantizeNotes(notes, selection, unit, duration, strength = 1, swing = 0) {
  return notes.map((note, index) => {
    if (!selection.includes(index)) return note;
    const step = Math.round(note.time / unit);
    const target = (step + (step % 2 ? swing : 0)) * unit;
    return {
      ...note,
      time: Math.max(
        0,
        Math.min(duration - note.duration, note.time + (target - note.time) * strength)
      ),
    };
  });
}

export function duplicateNotes(notes, selection, duration, unit) {
  const chosen = notes.filter((_, index) => selection.includes(index));
  if (!chosen.length) return { notes, selection };
  const first = chosen.reduce((n, note) => Math.min(n, note.time), Infinity);
  const end = chosen.reduce((n, note) => Math.max(n, note.time + note.duration), 0);
  const offset = Math.ceil((end - first) / unit) * unit;
  if (end + offset > duration + 1e-8) return { notes, selection };
  return {
    notes: [...notes, ...chosen.map((note) => ({ ...note, time: note.time + offset }))],
    selection: chosen.map((_, index) => notes.length + index),
  };
}
