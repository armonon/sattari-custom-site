const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values, average = mean(values)) {
  if (!values.length) return 0;
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function normalize(values) {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (!total) return values.map(() => 0);
  return values.map((value) => Math.max(0, value) / total);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export function downmixAudioBuffer(audioBuffer) {
  const output = new Float32Array(audioBuffer.length);
  const channelCount = Math.max(1, audioBuffer.numberOfChannels);

  for (let channel = 0; channel < channelCount; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let index = 0; index < output.length; index += 1) {
      output[index] += data[index] / channelCount;
    }
  }

  return output;
}

export function createWaveformPeaks(samples, binCount = 96) {
  if (!samples.length) return Array.from({ length: binCount }, () => 8);
  const bins = Math.max(8, binCount);
  const samplesPerBin = Math.max(1, Math.floor(samples.length / bins));

  return Array.from({ length: bins }, (_, bin) => {
    const start = bin * samplesPerBin;
    const end = bin === bins - 1 ? samples.length : Math.min(samples.length, start + samplesPerBin);
    let peak = 0;
    let energy = 0;

    for (let index = start; index < end; index += 1) {
      const absolute = Math.abs(samples[index]);
      peak = Math.max(peak, absolute);
      energy += absolute * absolute;
    }

    const rms = Math.sqrt(energy / Math.max(1, end - start));
    return Math.round(clamp((peak * 0.62 + rms * 1.8) * 100, 8, 100));
  });
}

function createOnsetEnvelope(samples, sampleRate) {
  const frameSize = 1024;
  const hopSize = 512;
  const frameCount = Math.max(0, Math.floor((samples.length - frameSize) / hopSize));
  const energy = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    let sum = 0;
    for (let index = 0; index < frameSize; index += 1) {
      const sample = samples[start + index];
      sum += sample * sample;
    }
    energy[frame] = Math.sqrt(sum / frameSize);
  }

  const envelope = new Float32Array(frameCount);
  for (let frame = 1; frame < frameCount; frame += 1) {
    envelope[frame] = Math.max(0, energy[frame] - energy[frame - 1]);
  }

  return { envelope, hopSize, sampleRate };
}

export function estimateTempo(samples, sampleRate) {
  const { envelope, hopSize } = createOnsetEnvelope(samples, sampleRate);
  if (envelope.length < 8) return { bpm: 96, confidence: 0 };

  const values = Array.from(envelope);
  const average = mean(values);
  const threshold = average + standardDeviation(values, average) * 0.72;
  const minimumFrames = Math.max(1, Math.round((0.18 * sampleRate) / hopSize));
  const peakTimes = [];
  let lastPeak = -minimumFrames;

  for (let index = 1; index < envelope.length - 1; index += 1) {
    if (
      envelope[index] > threshold &&
      envelope[index] >= envelope[index - 1] &&
      envelope[index] > envelope[index + 1] &&
      index - lastPeak >= minimumFrames
    ) {
      peakTimes.push((index * hopSize) / sampleRate);
      lastPeak = index;
    }
  }

  if (peakTimes.length < 4) return { bpm: 96, confidence: 0.08 };

  const histogram = new Map();
  for (let first = 0; first < peakTimes.length; first += 1) {
    for (let next = first + 1; next < Math.min(peakTimes.length, first + 9); next += 1) {
      const interval = peakTimes[next] - peakTimes[first];
      if (interval <= 0) continue;
      let bpm = 60 / interval;
      while (bpm < 70) bpm *= 2;
      while (bpm > 180) bpm /= 2;
      const bucket = Math.round(bpm * 2) / 2;
      const weight = 1 / (next - first);
      histogram.set(bucket, (histogram.get(bucket) || 0) + weight);
    }
  }

  const ranked = [...histogram.entries()].sort((left, right) => right[1] - left[1]);
  const [bestBpm = 96, bestScore = 0] = ranked[0] || [];
  const nearbyScore = ranked
    .filter(([bpm]) => Math.abs(bpm - bestBpm) <= 1.5)
    .reduce((sum, [, score]) => sum + score, 0);
  const totalScore = ranked.reduce((sum, [, score]) => sum + score, 0);

  return {
    bpm: Math.round(bestBpm),
    confidence: Number(
      clamp(((nearbyScore + bestScore) / Math.max(1, totalScore)) * 3.2, 0, 1).toFixed(2)
    ),
  };
}

function compactSamples(samples, sampleRate, targetRate = 11025) {
  if (sampleRate <= targetRate) return { samples, sampleRate };
  const ratio = Math.max(1, Math.floor(sampleRate / targetRate));
  const output = new Float32Array(Math.floor(samples.length / ratio));

  for (let index = 0; index < output.length; index += 1) {
    let sum = 0;
    for (let offset = 0; offset < ratio; offset += 1) {
      sum += samples[index * ratio + offset];
    }
    output[index] = sum / ratio;
  }

  return { samples: output, sampleRate: sampleRate / ratio };
}

function goertzelPower(samples, start, frameSize, frequency, sampleRate) {
  const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate);
  let previous = 0;
  let previousPrevious = 0;

  for (let index = 0; index < frameSize; index += 1) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (frameSize - 1));
    const current = samples[start + index] * window + coefficient * previous - previousPrevious;
    previousPrevious = previous;
    previous = current;
  }

  return Math.max(
    0,
    previousPrevious ** 2 + previous ** 2 - coefficient * previous * previousPrevious
  );
}

function chromaForRange(samples, sampleRate, startRatio = 0, endRatio = 1, windowCount = 12) {
  if (!samples.length) return Array.from({ length: 12 }, () => 0);
  const frameSize = Math.min(
    samples.length,
    4096,
    2 ** Math.floor(Math.log2(Math.max(32, samples.length / 4)))
  );
  const startSample = Math.floor(samples.length * startRatio);
  const endSample = Math.max(startSample + frameSize, Math.floor(samples.length * endRatio));
  const available = Math.max(0, endSample - startSample - frameSize);
  const chroma = Array.from({ length: 12 }, () => 0);

  for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
    const positionRatio = windowCount === 1 ? 0.5 : (windowIndex + 0.5) / windowCount;
    const frameStart = clamp(
      Math.floor(startSample + available * positionRatio),
      0,
      samples.length - frameSize
    );
    const frameChroma = Array.from({ length: 12 }, () => 0);

    for (let midi = 36; midi <= 83; midi += 1) {
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      if (frequency >= sampleRate / 2) continue;
      frameChroma[midi % 12] += Math.sqrt(
        goertzelPower(samples, frameStart, frameSize, frequency, sampleRate)
      );
    }

    const normalizedFrame = normalize(frameChroma);
    normalizedFrame.forEach((value, index) => {
      chroma[index] += value;
    });
  }

  return normalize(chroma);
}

function profileScore(chroma, profile, root) {
  const normalizedProfile = normalize(profile);
  return chroma.reduce(
    (score, value, pitchClass) => score + value * normalizedProfile[(pitchClass - root + 12) % 12],
    0
  );
}

export function estimateKeyFromChroma(chroma) {
  const candidates = [];
  for (let root = 0; root < 12; root += 1) {
    candidates.push({ root, mode: 'major', score: profileScore(chroma, MAJOR_PROFILE, root) });
    candidates.push({ root, mode: 'minor', score: profileScore(chroma, MINOR_PROFILE, root) });
  }
  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0];
  const runnerUp = candidates[1];
  const confidence = clamp((best.score - runnerUp.score) * 14 + 0.3, 0.12, 0.96);

  return {
    key: `${NOTE_NAMES[best.root]} ${best.mode}`,
    tonic: NOTE_NAMES[best.root],
    mode: best.mode,
    confidence: Number(confidence.toFixed(2)),
    chroma,
  };
}

function chordScore(chroma, root, minor) {
  const third = (root + (minor ? 3 : 4)) % 12;
  const fifth = (root + 7) % 12;
  const chordEnergy = chroma[root] * 1.35 + chroma[third] + chroma[fifth] * 0.9;
  const outsideEnergy = chroma.reduce(
    (sum, value, pitchClass) =>
      pitchClass === root || pitchClass === third || pitchClass === fifth ? sum : sum + value,
    0
  );
  return chordEnergy - outsideEnergy * 0.16;
}

function estimateChord(chroma) {
  const candidates = [];
  for (let root = 0; root < 12; root += 1) {
    candidates.push({ root, minor: false, score: chordScore(chroma, root, false) });
    candidates.push({ root, minor: true, score: chordScore(chroma, root, true) });
  }
  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0];
  return `${NOTE_NAMES[best.root]}${best.minor ? 'm' : ''}`;
}

function estimateSections(samples, sampleRate, duration) {
  const windowSeconds = clamp(duration / 60, 1.5, 4);
  const frameSize = Math.max(1, Math.floor(windowSeconds * sampleRate));
  const frameCount = Math.max(1, Math.floor(samples.length / frameSize));
  const energy = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * frameSize;
    const end = Math.min(samples.length, start + frameSize);
    let sum = 0;
    for (let index = start; index < end; index += 1) sum += samples[index] ** 2;
    energy.push(Math.sqrt(sum / Math.max(1, end - start)));
  }

  const novelty = energy.map((value, index) => (index ? Math.abs(value - energy[index - 1]) : 0));
  const candidates = novelty
    .map((value, index) => ({ value, time: index * windowSeconds }))
    .filter(({ time }) => time > duration * 0.14 && time < duration * 0.86)
    .sort((left, right) => right.value - left.value);
  const boundaries = [];

  for (const candidate of candidates) {
    if (boundaries.every((boundary) => Math.abs(boundary - candidate.time) > duration * 0.12)) {
      boundaries.push(candidate.time);
    }
    if (boundaries.length === 3) break;
  }

  while (boundaries.length < 3) boundaries.push((duration * (boundaries.length + 1)) / 4);
  boundaries.sort((left, right) => left - right);

  const points = [0, ...boundaries, duration];
  const labels = ['Opening', 'Part A', 'Part B', 'Closing'];
  return labels.map((name, index) => ({
    name,
    start: points[index],
    end: points[index + 1],
    range: `${formatTime(points[index])} - ${formatTime(points[index + 1])}`,
    width: Number((((points[index + 1] - points[index]) / duration) * 100).toFixed(2)),
  }));
}

function calculateLevel(samples) {
  let sum = 0;
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const absolute = Math.abs(samples[index]);
    sum += samples[index] ** 2;
    peak = Math.max(peak, absolute);
  }
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  const rmsDb = rms ? 20 * Math.log10(rms) : -96;
  const peakDb = peak ? 20 * Math.log10(peak) : -96;
  return { rmsDb: Number(rmsDb.toFixed(1)), peakDb: Number(peakDb.toFixed(1)) };
}

export function analyzeDecodedAudio(audioBuffer) {
  const originalSamples = downmixAudioBuffer(audioBuffer);
  const { samples, sampleRate } = compactSamples(originalSamples, audioBuffer.sampleRate);
  const tempo = estimateTempo(samples, sampleRate);
  const globalChroma = chromaForRange(samples, sampleRate, 0.05, 0.95, 20);
  const key = estimateKeyFromChroma(globalChroma);
  const chords = Array.from({ length: 4 }, (_, index) =>
    estimateChord(chromaForRange(samples, sampleRate, index / 4, (index + 1) / 4, 8))
  );
  const duration = audioBuffer.duration;

  return {
    source: 'local-analysis',
    duration,
    durationLabel: formatTime(duration),
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
    key: key.key,
    tonic: key.tonic,
    mode: key.mode,
    bpm: tempo.bpm,
    feel:
      tempo.bpm < 82
        ? 'Slow pulse'
        : tempo.bpm < 112
          ? 'Mid-tempo pocket'
          : tempo.bpm < 145
            ? 'Driving pulse'
            : 'Fast pulse',
    chords,
    sections: estimateSections(samples, sampleRate, duration),
    waveform: createWaveformPeaks(originalSamples),
    level: calculateLevel(originalSamples),
    confidence: {
      tempo: tempo.confidence,
      key: key.confidence,
      chords: Number(clamp((key.confidence + tempo.confidence) / 2 - 0.08, 0.1, 0.9).toFixed(2)),
    },
  };
}

export async function analyzeAudioFile(file, onProgress) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio is not supported by this browser.');

  onProgress?.({ value: 12, label: 'Reading audio' });
  const arrayBuffer = await file.arrayBuffer();
  const context = new AudioContextClass();

  try {
    onProgress?.({ value: 34, label: 'Decoding track' });
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    onProgress?.({ value: 58, label: 'Finding pulse and key' });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const analysis = analyzeDecodedAudio(audioBuffer);
    onProgress?.({ value: 100, label: 'Lesson ready' });
    return analysis;
  } finally {
    await context.close().catch(() => {});
  }
}

export function detectPitch(samples, sampleRate) {
  let rms = 0;
  for (let index = 0; index < samples.length; index += 1) rms += samples[index] ** 2;
  rms = Math.sqrt(rms / samples.length);
  if (rms < 0.012) return null;

  const minimumOffset = Math.floor(sampleRate / 1000);
  const maximumOffset = Math.min(Math.floor(sampleRate / 55), samples.length / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  const correlations = new Float32Array(maximumOffset + 1);

  for (let offset = minimumOffset; offset <= maximumOffset; offset += 1) {
    let correlation = 0;
    let normA = 0;
    let normB = 0;
    for (let index = 0; index < samples.length - offset; index += 1) {
      correlation += samples[index] * samples[index + offset];
      normA += samples[index] ** 2;
      normB += samples[index + offset] ** 2;
    }
    correlation /= Math.sqrt(normA * normB) || 1;
    correlations[offset] = correlation;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset < 0 || bestCorrelation < 0.72) return null;
  for (let offset = minimumOffset; offset < bestOffset; offset += 1) {
    if (
      correlations[offset] >= bestCorrelation * 0.995 &&
      correlations[offset] >= correlations[offset - 1] &&
      correlations[offset] >= correlations[offset + 1]
    ) {
      bestOffset = offset;
      bestCorrelation = correlations[offset];
      break;
    }
  }
  const frequency = sampleRate / bestOffset;
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const exactMidi = 69 + 12 * Math.log2(frequency / 440);
  const note = `${NOTE_NAMES[(midi + 1200) % 12]}${Math.floor(midi / 12) - 1}`;

  return {
    frequency: Number(frequency.toFixed(1)),
    midi,
    pitchClass: NOTE_NAMES[(midi + 1200) % 12],
    note,
    cents: Math.round((exactMidi - midi) * 100),
    clarity: Number(bestCorrelation.toFixed(2)),
  };
}

export { NOTE_NAMES };
