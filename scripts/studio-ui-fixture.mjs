// Tiny deterministic source + populated arrangement; no external assets or user files.
export function releaseProjectFixture() {
  const rate = 44100,
    samples = rate * 8;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++)
    wav.writeInt16LE(
      Math.round(600 * Math.sin((2 * Math.PI * 220 * index) / rate)),
      44 + index * 2
    );
  const tracks = Array.from({ length: 6 }, (_, index) => ({
    id: `qa-track-${index}`,
    name: `QA ${index + 1}`,
    kind: index === 0 ? 'midi' : 'audio',
    gain: 50,
    pan: 0,
    muted: false,
    solo: false,
    clips: [
      {
        id: `qa-clip-${index}`,
        kind: index === 0 ? 'midi' : 'audio',
        assetId: index === 0 ? '' : 'qa-tone',
        name: index === 0 ? 'QA melody' : `QA source ${index}`,
        start: 0,
        offset: 0,
        duration: 8,
        sourceDuration: 8,
        rate: 1,
        gain: 100,
        fadeIn: 0.005,
        fadeOut: 0.005,
        automation: { volume: [], pan: [], filter: [] },
        ...(index === 0
          ? {
              instrument: 'piano',
              timebase: 'seconds',
              notes: [
                { id: 'qa-note-1', pitch: 'C4', time: 0, duration: 0.5, velocity: 0.7 },
                { id: 'qa-note-2', pitch: 'E4', time: 1, duration: 0.5, velocity: 0.7 },
              ],
            }
          : {}),
      },
    ],
  }));
  return {
    schema: 'SattariStudio.project.v4',
    sessionName: 'Session Integrity QA',
    master: { bpm: 120, level: 30 },
    decks: [
      {
        id: 'A',
        title: 'QA source',
        bpm: 120,
        duration: 8,
        lanes: { fullMix: { assetId: 'qa-tone', name: 'QA source', duration: 8 } },
      },
    ],
    pads: [],
    pianoNotes: [],
    recordings: [],
    arranger: { version: 1, tracks, captures: [] },
    assets: [
      {
        id: 'qa-tone',
        name: 'qa-tone.wav',
        type: 'audio/wav',
        data: `data:audio/wav;base64,${wav.toString('base64')}`,
      },
    ],
  };
}
