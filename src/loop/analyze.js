import { chromaForRange, estimateTempo } from '../utils/audioAnalysis';
import { NOTE_NAMES, positionForMidi } from './music';
import { detectFundamental, reduceSampleRate } from './pitch';
import { analyzeAutoKey } from './autoKey';
import { chordsFromPolyphonic, coveredDuration } from './harmony';

export function estimateChordFromChroma(chroma) {
  const energy = chroma.reduce((a, b) => a + b, 0);
  if (energy < 0.001 || chroma.some((value) => !Number.isFinite(value) || value < 0)) return null;
  chroma = chroma.map((value) => value / energy);
  const choices = [];
  for (let root = 0; root < 12; root++)
    for (const minor of [false, true]) {
      const tones = [root, (root + (minor ? 3 : 4)) % 12, (root + 7) % 12];
      const coverage = tones.reduce((sum, n) => sum + chroma[n], 0);
      choices.push({
        name: NOTE_NAMES[root] + (minor ? 'm' : ''),
        score: coverage + chroma[root] * 0.2,
        coverage,
        weakestTone: Math.min(...tones.map((n) => chroma[n])),
      });
    }
  choices.sort((a, b) => b.score - a.score);
  const best = choices[0];
  // Flat spectra and one-note windows cannot identify a major/minor triad.
  if (best.coverage < 0.58 || best.weakestTone < 0.08 || best.score - choices[1].score < 0.055)
    return null;
  return { name: best.name, confidence: Math.min(0.9, best.coverage) };
}

export function transcribeMelody(input, inputRate, progress = () => {}) {
  const { samples, rate } = reduceSampleRate(input, inputRate, 8000);
  const size = 1024,
    hop = 256;
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  const floor = Math.max(0.0006, Math.min(0.006, peak * 0.025));
  const events = [];
  let current = null,
    previousPosition = null;
  const close = () => {
    if (current && current.end - current.start >= 0.11 && current.frames >= 3) {
      const position = positionForMidi(current.midi, previousPosition);
      if (position) {
        events.push({
          midi: current.midi,
          start: current.start,
          end: current.end,
          confidence: current.confidence / current.frames,
          ...position,
        });
        previousPosition = position;
      }
    }
    current = null;
  };
  for (let start = 0; start + size <= samples.length; start += hop) {
    // A pitch window can span a short rest and merge two plucks of the same
    // note. Gate the leading hop separately so those rests split the events.
    let onsetEnergy = 0;
    for (let i = start; i < start + hop; i++) onsetEnergy += samples[i] ** 2;
    if (Math.sqrt(onsetEnergy / hop) < floor) {
      close();
      continue;
    }
    const pitch = detectFundamental(
      samples.subarray(start, start + size),
      rate,
      70,
      1320,
      floor * 0.7
    );
    const time = start / rate;
    if (!pitch || pitch.clarity < 0.86 || pitch.midi < 40 || pitch.midi > 84) {
      close();
      continue;
    }
    if (!current || current.midi !== pitch.midi) {
      close();
      current = { midi: pitch.midi, start: time, end: time + hop / rate, confidence: 0, frames: 0 };
    }
    current.end = Math.min(samples.length / rate, time + (size / rate) * 0.75);
    current.confidence += pitch.clarity;
    current.frames++;
    if (start % (hop * 64) === 0) progress(start / samples.length);
  }
  close();
  // Analysis windows may overlap a pitch change. Bound every event by the next onset.
  return events.map((event, i) => ({
    ...event,
    end: Math.min(event.end, events[i + 1]?.start ?? Infinity),
  }));
}

export function analyzeSong(samples, rate, progress = () => {}, options = {}) {
  const duration = samples.length / rate;
  progress(8, 'Finding the pulse');
  const tempo = estimateTempo(options.keySamples || samples, options.keyRate || rate);
  progress(12, 'Listening with Sattari AutoKey');
  const key = analyzeAutoKey(options.keySamples || samples, options.keyRate || rate, (value) =>
    progress(12 + value * 8, 'Listening with Sattari AutoKey')
  );
  progress(20, 'Sketching the chord chart');
  let chords = [];
  const step = Math.max(1, 240 / tempo.bpm);
  for (let start = 0; start < duration; start += step) {
    const end = Math.min(duration, start + step);
    const part = samples.subarray(Math.floor(start * rate), Math.floor(end * rate));
    let rms = 0;
    for (let i = 0; i < part.length; i++) rms += part[i] * part[i];
    if (Math.sqrt(rms / Math.max(1, part.length)) < 0.006) continue;
    const chord = estimateChordFromChroma(chromaForRange(part, rate, 0, 1, 3));
    if (chord) chords.push({ ...chord, start, end });
  }
  if (options.polyphonicNotes)
    chords = chordsFromPolyphonic(options.polyphonicNotes, duration, tempo.bpm);
  progress(40, 'Finding individual notes');
  const notes =
    options.notes ||
    transcribeMelody(samples, rate, (value) =>
      progress(40 + value * 52, 'Finding individual notes')
    );
  const waveform = Array.from({ length: 160 }, (_, bin) => {
    const start = Math.floor((bin * samples.length) / 160),
      end = Math.floor(((bin + 1) * samples.length) / 160);
    let energy = 0;
    for (let i = start; i < end; i++) energy += samples[i] ** 2;
    return Math.sqrt(energy / Math.max(1, end - start));
  });
  const peak = Math.max(...waveform, 0.001);
  const covered = coveredDuration(notes);
  const averageClarity = notes.length
    ? notes.reduce((sum, note) => sum + note.confidence, 0) / notes.length
    : 0;
  return {
    quality: {
      version: 3,
      coverage: duration ? Math.min(1, covered / duration) : 0,
      averageClarity,
      shortNotes: notes.filter((note) => note.end - note.start < 0.18).length,
      requiresReview: true,
      method: options.pitchEngine || 'single-note',
      pitchFallback: options.pitchFallback || false,
      preparation: options.preparation || 'original',
      harmonyMethod: options.polyphonicNotes ? 'basic-pitch' : 'chroma',
      harmonyFallback: options.harmonyFallback || false,
    },
    duration,
    bpm: tempo.bpm,
    key: key.evidence !== 'insufficient' ? key.key : 'Uncertain key',
    keyAnalysis: key,
    chords,
    notes,
    ...(options.polyphonicNotes ? { polyphonicNotes: options.polyphonicNotes } : {}),
    waveform: waveform.map((v) => v / peak),
    source: 'estimate',
    confidence: { key: key.margin, tempo: tempo.confidence },
  };
}
