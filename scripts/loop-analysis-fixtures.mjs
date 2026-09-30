// Deterministic signals only: these checks are not a real-guitar accuracy corpus.
export function keyProgression(root, minor, rate = 44100) {
  // Match core/tests/song_key_estimator_contract.cpp in sattari-plugins-main.
  const chordSamples = Math.round(1.25 * rate);
  const audio = new Float32Array(chordSamples * 8);
  const roots = [
    root,
    (root + 5) % 12,
    (root + 7) % 12,
    root,
    root,
    (root + 5) % 12,
    (root + 7) % 12,
    root,
  ];
  roots.forEach((r, chord) => {
    const chordMinor = chord === 1 ? minor : chord === 2 ? false : minor;
    for (let i = 0; i < chordSamples; i++) {
      const edge = Math.min(1, i / 256, (chordSamples - 1 - i) / 256);
      let sample = 0;
      for (const pc of [r, (r + (chordMinor ? 3 : 4)) % 12, (r + 7) % 12]) {
        const midi = 12 * ((pc < 5 ? 4 : 3) + 1) + pc;
        const hz = 440 * 2 ** ((midi - 69) / 12),
          time = i / rate;
        sample +=
          0.2 * Math.sin(2 * Math.PI * hz * time) + 0.05 * Math.sin(4 * Math.PI * hz * time);
      }
      audio[chord * chordSamples + i] = edge * sample;
    }
  });
  return audio;
}

export function melodyFixture({
  midis = [40, 45, 50, 55, 59, 64, 67, 71, 76],
  spacing = 0.5,
  length = 0.36,
  noise = 0,
  gain = 1,
  harmonics = true,
} = {}) {
  const rate = 16000,
    audio = new Float32Array(Math.ceil((midis.length * spacing + 0.3) * rate));
  const expected = midis.map((midi, index) => ({
    midi,
    start: index * spacing + 0.1,
    end: index * spacing + 0.1 + length,
  }));
  for (const note of expected) {
    const hz = 440 * 2 ** ((note.midi - 69) / 12);
    for (let i = 0; i < length * rate; i++) {
      const t = i / rate;
      const envelope = Math.min(1, t / 0.003, (length - t) / 0.012) * Math.exp(-t * 3);
      const phase = 2 * Math.PI * hz * t;
      audio[Math.round(note.start * rate) + i] +=
        gain *
        envelope *
        (0.18 * Math.sin(phase) +
          (harmonics ? 0.24 * Math.sin(phase * 2) + 0.08 * Math.sin(phase * 3) : 0));
    }
  }
  let seed = 23;
  for (let i = 0; i < audio.length; i++) {
    seed = Math.imul(seed, 1664525) + 1013904223;
    audio[i] += ((seed >>> 0) / 4294967296 - 0.5) * noise;
  }
  return { audio, rate, expected };
}

export function floatWave(samples, rate) {
  const bytes = Buffer.alloc(44 + samples.length * 4);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(3, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 4, 28);
  bytes.writeUInt16LE(4, 32);
  bytes.writeUInt16LE(32, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples.length * 4, 40);
  for (let i = 0; i < samples.length; i++) bytes.writeFloatLE(samples[i], 44 + i * 4);
  return bytes;
}
