import { describeAudioSource } from './windowedSource';
import { decodeSourceWindow } from './arrangementSourceWindow';
import { analyzeDecodedAudio, sectionsFromEnergy } from './audioAnalysis';

// Scan all source samples without keeping a whole-song PCM copy. Musical estimates
// use overlapping 120-second compact blocks; waveform/level statistics cover the
// entire source. Beat/key estimates are not a musical qualification certificate.
export async function analyzeWindowedAudio(
  file,
  raw,
  {
    describe = describeAudioSource,
    decode = decodeSourceWindow,
    analyze = analyzeDecodedAudio,
    onProgress,
    signal,
  } = {}
) {
  const source = await describe(file);
  const rate = source.sampleRate;
  const stride = Math.max(1, Math.floor(rate / 11025));
  const compactRate = rate / stride;
  const capacity = Math.floor(compactRate * 124);
  const overlap = Math.floor(compactRate * 4);
  const compact = new Float32Array(capacity);
  const totalFrames = Math.ceil(source.duration * rate);
  const binWidth = Math.max(1, Math.floor(totalFrames / 96));
  const peaks = new Float64Array(96),
    energies = new Float64Array(96),
    counts = new Uint32Array(96);
  const sectionSeconds = Math.max(1.5, Math.min(4, source.duration / 60));
  const sectionFrames = Math.max(1, Math.floor(sectionSeconds * rate));
  const sectionEnergy = [],
    sectionCounts = [];
  const bpmVotes = new Map(),
    keyVotes = new Map(),
    parts = [],
    beats = [];
  let length = 0,
    compactStart = 0,
    partial = 0,
    partialCount = 0;
  let squares = 0,
    peak = 0,
    frames = 0;
  let confidence = 0,
    weight = 0;
  const processBlock = async (final = false) => {
    if (!length || (compactStart && length <= overlap)) return;
    const samples = compact.slice(0, length);
    const result = await analyze({
      length,
      sampleRate: compactRate,
      numberOfChannels: 1,
      duration: length / compactRate,
      getChannelData: () => samples,
    });
    const duration = length / compactRate - (compactStart ? overlap / compactRate : 0);
    bpmVotes.set(result.bpm, (bpmVotes.get(result.bpm) || 0) + duration * result.confidence.tempo);
    const existing = keyVotes.get(result.key) || { score: 0, result };
    existing.score += duration * result.confidence.key;
    keyVotes.set(result.key, existing);
    for (const beat of result.tempoMap?.beats || []) {
      const time = compactStart / compactRate + beat.time;
      if (time < (compactStart ? (compactStart + overlap) / compactRate : 0)) continue;
      if (beats.length && time - beats.at(-1).time < 0.25) continue;
      beats.push({ ...beat, time });
    }
    confidence += (result.tempoMap?.confidence || 0) * duration;
    weight += duration;
    // Keep only compact descriptive data, not the block's waveform/beat arrays.
    parts.push({
      start: compactStart / compactRate,
      end: (compactStart + length) / compactRate,
      chords: result.chords,
      confidence: result.confidence,
    });
    if (!final) {
      compact.copyWithin(0, length - overlap, length);
      compactStart += length - overlap;
      length = overlap;
    }
  };
  // Reserve at most 16 MiB output PCM per window, even for multichannel/high-rate media.
  const budget = 16 * 1048576;
  const windowFrames = Math.max(
    1,
    Math.min(rate * 4, Math.floor(budget / (source.channels * 4)) - 2)
  );
  for (let first = 0; first < totalFrames; first += windowFrames) {
    if (signal?.aborted) throw new Error('Track analysis cancelled.');
    const last = Math.min(totalFrames, first + windowFrames);
    const { buffer, offset } = await decode(raw, file, first / rate, last / rate, budget, {
      signal,
    });
    if (buffer.sampleRate !== rate || buffer.numberOfChannels !== source.channels)
      throw new Error('Audio format changed during analysis. Convert the source to PCM WAV.');
    const begin = Math.round(first - offset * rate);
    const count = Math.min(last - first, buffer.length - begin);
    if (begin < 0 || count < last - first - 1)
      throw new Error('Incomplete audio window during analysis.');
    const channels = Array.from({ length: source.channels }, (_, c) => buffer.getChannelData(c));
    for (let n = 0; n < count; n++) {
      let sample = 0;
      for (const channel of channels) sample += channel[begin + n] / channels.length;
      if (!Number.isFinite(sample)) throw new Error('Source contains invalid samples.');
      const square = sample * sample,
        absolute = Math.abs(sample),
        at = first + n;
      squares += square;
      peak = Math.max(peak, absolute);
      frames++;
      const bin = Math.min(95, Math.floor(at / binWidth));
      peaks[bin] = Math.max(peaks[bin], absolute);
      energies[bin] += square;
      counts[bin]++;
      const section = Math.floor(at / sectionFrames);
      sectionEnergy[section] = (sectionEnergy[section] || 0) + square;
      sectionCounts[section] = (sectionCounts[section] || 0) + 1;
      partial += sample;
      partialCount++;
      if (partialCount === stride) {
        compact[length++] = partial / stride;
        partial = 0;
        partialCount = 0;
        if (length === capacity) await processBlock();
      }
    }
    onProgress?.({
      value: Math.round(12 + (last / totalFrames) * 85),
      label: 'Finding pulse and key',
    });
    // Allow cancellation, rendering and audio preparation between bounded chunks.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await processBlock(true);
  const winner = [...keyVotes.values()].sort((a, b) => b.score - a.score)[0]?.result;
  if (!winner) throw new Error('No audio was available for analysis.');
  const bpm = [...bpmVotes].sort((a, b) => b[1] - a[1])[0][0];
  const db = (amplitude) => Number((amplitude ? 20 * Math.log10(amplitude) : -96).toFixed(1));
  return {
    ...winner,
    source: 'windowed-local-analysis-v1',
    duration: source.duration,
    sampleRate: rate,
    channels: source.channels,
    bpm,
    durationLabel: `${Math.floor(Math.round(source.duration) / 60)}:${String(Math.round(source.duration) % 60).padStart(2, '0')}`,
    feel:
      bpm < 82
        ? 'Slow pulse'
        : bpm < 112
          ? 'Mid-tempo pocket'
          : bpm < 145
            ? 'Driving pulse'
            : 'Fast pulse',
    waveform: Array.from(peaks, (value, i) =>
      Math.round(
        Math.max(
          8,
          Math.min(
            100,
            (value * 0.62 + Math.sqrt(energies[i] / Math.max(1, counts[i])) * 1.8) * 100
          )
        )
      )
    ),
    level: { rmsDb: db(Math.sqrt(squares / Math.max(1, frames))), peakDb: db(peak) },
    tempoMap: {
      beats,
      confidence: weight ? confidence / weight : 0,
      method: 'windowed-tempo-state-onset-v1',
    },
    sections: sectionsFromEnergy(
      sectionEnergy.map((e, i) => Math.sqrt(e / sectionCounts[i])),
      sectionSeconds,
      source.duration
    ),
    chords: Array.from({ length: 4 }, (_, i) => {
      const position = (source.duration * (i + 0.5)) / 4;
      const part = parts.find((p) => position >= p.start && position < p.end) || parts.at(-1);
      return part.chords[
        Math.min(3, Math.floor(((position - part.start) / (part.end - part.start)) * 4))
      ];
    }),
    analysisCoverage: {
      seconds: frames / rate,
      blockSeconds: 124,
      overlapSeconds: 4,
      maxWindowPcmBytes: budget,
      wholeSourceDecoded: false,
    },
  };
}

/**
 * createWaveformPeaks for a whole recording, read in windows: an hour-long take
 * never needs a full decode (about 1.4 GB of PCM) just to draw its lane.
 */
export async function windowedWaveformPeaks(
  file,
  raw,
  {
    duration,
    binCount = 2048,
    windowSeconds = 30,
    decode = decodeSourceWindow,
    signal,
    cacheKey,
  } = {}
) {
  if (!(duration > 0)) throw new Error('Recording length is unknown.');
  const bins = Math.max(8, binCount);
  const peaks = new Float64Array(bins),
    energy = new Float64Array(bins),
    counts = new Float64Array(bins);
  for (let start = 0; start < duration; start += windowSeconds) {
    if (signal?.aborted) throw new Error('Waveform cancelled.');
    const { buffer, offset } = await decode(
      raw,
      file,
      start,
      Math.min(duration, start + windowSeconds),
      64 * 1024 * 1024,
      { signal, cacheKey }
    );
    const samples = buffer.getChannelData(0),
      rate = buffer.sampleRate,
      first = Math.round(offset * rate),
      total = duration * rate;
    for (let index = 0; index < samples.length; index += 1) {
      const bin = Math.min(bins - 1, Math.floor(((first + index) / total) * bins));
      const absolute = Math.abs(samples[index]);
      if (absolute > peaks[bin]) peaks[bin] = absolute;
      energy[bin] += absolute * absolute;
      counts[bin] += 1;
    }
  }
  return Array.from(peaks, (peak, bin) => {
    const rms = Math.sqrt(energy[bin] / Math.max(1, counts[bin]));
    return Math.round(Math.min(100, Math.max(8, (peak * 0.62 + rms * 1.8) * 100)));
  });
}
