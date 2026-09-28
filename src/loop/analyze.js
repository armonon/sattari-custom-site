import { chromaForRange, estimateKeyFromChroma, estimateTempo } from '../utils/audioAnalysis';
import { NOTE_NAMES, positionForMidi } from './music';
import { detectFundamental, reduceSampleRate } from './pitch';

export function estimateChordFromChroma(chroma) {
  if (chroma.reduce((a, b) => a + b, 0) < 0.001) return null;
  const choices = [];
  for (let root = 0; root < 12; root++)
    for (const minor of [false, true]) {
      const tones = [root, (root + (minor ? 3 : 4)) % 12, (root + 7) % 12];
      const coverage = tones.reduce((sum, n) => sum + chroma[n], 0);
      choices.push({
        name: NOTE_NAMES[root] + (minor ? 'm' : ''),
        score: coverage + chroma[root] * 0.2,
        coverage,
      });
    }
  choices.sort((a, b) => b.score - a.score);
  return { name: choices[0].name, confidence: Math.min(0.9, choices[0].coverage) };
}

export function transcribeMelody(input, inputRate, progress = () => {}) {
  const { samples, rate } = reduceSampleRate(input, inputRate, 8000);
  const size = 1024,
    hop = 256;
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
    if (Math.sqrt(onsetEnergy / hop) < 0.006) {
      close();
      continue;
    }
    const pitch = detectFundamental(samples.subarray(start, start + size), rate);
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

export function analyzeSong(samples, rate, progress = () => {}) {
  const duration = samples.length / rate;
  progress(8, 'Finding the pulse');
  const tempo = estimateTempo(samples, rate);
  const chroma = chromaForRange(samples, rate, 0, 1, 24);
  const key = estimateKeyFromChroma(chroma);
  progress(20, 'Sketching the chord chart');
  const chords = [];
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
  progress(40, 'Finding individual notes');
  const notes = transcribeMelody(samples, rate, (value) =>
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
  return {
    duration,
    bpm: tempo.bpm,
    key: key.key,
    chords,
    notes,
    waveform: waveform.map((v) => v / peak),
    source: 'estimate',
    confidence: { key: key.confidence, tempo: tempo.confidence },
  };
}
