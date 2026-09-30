import { positionForMidi } from './music';
import { chordFromNotes } from './harmony';

export function scoreTracks(score) {
  if (!score.masterBars.length || score.masterBars.length > 256)
    throw new Error('Use a score with 1–256 measures.');
  if (
    score.masterBars.some(
      (bar) => bar.timeSignatureNumerator !== 4 || bar.timeSignatureDenominator !== 4
    )
  )
    throw new Error(
      'This first score importer supports 4/4 excerpts. Export a 4/4 passage to practice here.'
    );
  const bpm = score.tempo || 120;
  if (
    score.masterBars.some((bar) => bar.tempoAutomations.some((t) => Math.abs(t.value - bpm) > 0.1))
  )
    throw new Error(
      'Please export a passage with one steady tempo. Tempo changes are not supported yet.'
    );
  const seconds = (ticks) => ((ticks / 960) * 60) / bpm;
  const warnings = [
    'Repeats are read once in written order. Bends, slides and expressive techniques need the original score.',
  ];
  return score.tracks.flatMap((track) =>
    track.staves.flatMap((staff, staffIndex) => {
      if (staff.isPercussion) return [];
      const all = [],
        sections = [];
      for (const bar of staff.bars) {
        if (bar.masterBar.section)
          sections.push({
            title: bar.masterBar.section.text || `Section ${sections.length + 1}`,
            start: seconds(bar.masterBar.start),
          });
        for (const voice of bar.voices)
          for (const beat of voice.beats)
            for (const note of beat.notes) {
              if (note.isTieDestination || note.isDead) continue;
              // MusicXML may include fret hints without staff tuning. In that
              // case alphaTab's string pitch is incomplete; retain written pitch.
              const midi =
                !staff.tuning.length && note.fret >= 0 && note.octave >= 0 && note.tone >= 0
                  ? note.octave * 12 + note.tone - staff.transpositionPitch
                  : note.realValue;
              const position =
                positionForMidi(midi) ||
                (midi >= 38 && midi < 40 ? { string: 0, fret: midi - 38 } : null);
              if (!position) continue;
              let endTick = beat.absolutePlaybackStart + beat.playbackDuration;
              let tied = note.tieDestination,
                visited = 0;
              while (tied && visited++ < 256) {
                endTick = Math.max(
                  endTick,
                  tied.beat.absolutePlaybackStart + tied.beat.playbackDuration
                );
                tied = tied.tieDestination;
              }
              const original =
                note.string >= 1 && note.string <= 6 && note.fret >= 0
                  ? { string: note.string - 1, fret: note.fret }
                  : position;
              all.push({
                midi,
                start: seconds(beat.absolutePlaybackStart),
                end: seconds(endTick),
                beatStart: beat.absolutePlaybackStart / 960,
                beatDuration: (endTick - beat.absolutePlaybackStart) / 960,
                confidence: 1,
                ...original,
              });
            }
      }
      all.sort((a, b) => a.start - b.start || b.midi - a.midi);
      if (!all.length) return [];
      if (all.length > 12000 || Math.max(...all.map((n) => n.end)) > 480)
        throw new Error('Use an excerpt shorter than eight minutes and 12,000 notes.');
      const groups = [];
      for (const note of all) {
        const last = groups.at(-1);
        if (last && Math.abs(last[0].start - note.start) < 0.001) last.push(note);
        else groups.push([note]);
      }
      const notes = groups.map((g) => g[0]);
      const chords = groups.flatMap((g) => {
        const chord = chordFromNotes(g);
        return chord
          ? [
              {
                name: chord.name,
                start: g[0].start,
                end: Math.max(...g.map((n) => n.end)),
                confidence: 1,
              },
            ]
          : [];
      });
      return [
        {
          title: score.title || 'Imported score',
          artist: score.artist || score.composer || 'Your score',
          trackName: `${track.name || `Track ${track.index + 1}`}${track.staves.length > 1 ? ` · staff ${staffIndex + 1}` : ''}`,
          bpm,
          key: 'Not specified',
          duration: Math.max(...all.map((n) => n.end)),
          notes,
          chords,
          polyphonicNotes: all.length > notes.length ? all : undefined,
          sections,
          warnings,
          source: 'score',
          meter: 4,
          sourceTuning: [...staff.tuning].reverse(),
          sourceCapo: staff.capo || 0,
        },
      ];
    })
  );
}

export function alignScore(track, offset = 0, tempo = track.bpm) {
  if (
    !Number.isFinite(offset) ||
    offset < 0 ||
    offset > 120 ||
    !Number.isFinite(tempo) ||
    tempo < 30 ||
    tempo > 240
  )
    throw new Error('Choose a start offset from 0–120 seconds and tempo from 30–240 BPM.');
  const ratio = track.bpm / tempo;
  const align = (n) => ({ ...n, start: offset + n.start * ratio, end: offset + n.end * ratio });
  return {
    ...track,
    bpm: tempo,
    notes: track.notes.map(align),
    chords: track.chords.map(align),
    polyphonicNotes: track.polyphonicNotes?.map(align),
    sections: track.sections.map((s) => ({ ...s, start: offset + s.start * ratio })),
    duration: offset + track.duration * ratio,
    practiceStart: offset,
    scoreAlignment: { offset, tempo },
    description: `${track.trackName}. Score import · compare with your recording before practicing.`,
    id: `score-${crypto.randomUUID()}`,
  };
}
