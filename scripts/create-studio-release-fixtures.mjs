// Deterministic, quiet audio for local release QA. No user media is accessed.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve(process.argv[2] || '/tmp/stemdeck-release-fixtures');
await mkdir(directory, { recursive: true });
const sampleRate = 44100;
const samples = sampleRate * 8;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples * 2, 40);
for (let index = 0; index < samples; index++) {
  const edge = Math.min(1, index / 441, (samples - index) / 441);
  wav.writeInt16LE(Math.round(983 * edge * Math.sin(2 * Math.PI * 220 * index / sampleRate)), 44 + index * 2);
}
await writeFile(resolve(directory, 'release-tone.wav'), wav);
const project = {
  schema: 'SattariStudio.project.v4', sessionName: 'Release QA fixture',
  master: { bpm: 120, level: 50 },
  decks: [{ id: 'A', title: 'Release tone', bpm: 120, duration: 8,
    waveform: Array(100).fill(0.2),
    lanes: { fullMix: { assetId: 'qa-tone', name: 'Release tone', duration: 8 } } }],
  pads: [{ assetId: 'qa-tone', name: 'QA pad', gain: 50 }],
  pianoNotes: [{ pitch: 'C4', step: 0, velocity: 96 }],
  recordings: [],
  assets: [{ id: 'qa-tone', name: 'release-tone.wav', type: 'audio/wav',
    data: `data:audio/wav;base64,${wav.toString('base64')}` }],
};
await writeFile(resolve(directory, 'release-project.sattari'), JSON.stringify(project));
await writeFile(resolve(directory, 'future-project.sattari'), JSON.stringify({ ...project, schema: 'SattariStudio.project.v99', assets: [] }));
await writeFile(resolve(directory, 'invalid-audio.wav'), 'Not an audio file');
console.log(directory);
