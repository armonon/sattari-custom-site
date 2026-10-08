// Original generated PCM only. No downloads, copyrighted songs or physical inputs.
import { createHash } from 'node:crypto';
export function performLifecycleFixture() {
  const rate = 44100,
    duration = 32,
    samples = rate * duration;
  const assets = [],
    decks = [],
    files = [],
    hashes = {};
  for (const [deckIndex, id] of ['A', 'B', 'C', 'D'].entries()) {
    const lanes = {},
      mix = new Float32Array(samples);
    for (const [stemIndex, stem] of ['drums', 'bass', 'music', 'vocals'].entries()) {
      const pcm = new Float32Array(samples);
      for (let sample = 0; sample < samples; sample++) {
        const t = sample / rate,
          beatPhase = t % 0.5;
        const frequency = [110, 130.8128, 261.6256, 329.6276][stemIndex] * 2 ** (deckIndex / 12);
        pcm[sample] =
          0.06 *
          Math.sin(2 * Math.PI * frequency * t) *
          (stemIndex === 0 ? Math.exp(-beatPhase * 28) : 0.7 + 0.3 * Math.exp(-beatPhase * 7));
        mix[sample] += pcm[sample];
      }
      const wav = encodeWav(pcm, rate),
        assetId = `lifecycle-${id}-${stem}`,
        name = `${id}-${stem}.wav`;
      assets.push({
        id: assetId,
        name,
        type: 'audio/wav',
        data: `data:audio/wav;base64,${wav.toString('base64')}`,
      });
      hashes[assetId] = createHash('sha256').update(wav).digest('hex');
      lanes[stem] = { assetId, name, duration, level: 100, muted: false };
    }
    const wav = encodeWav(mix, rate),
      assetId = `lifecycle-${id}-fullMix`,
      name = `${id}-fullMix.wav`;
    assets.push({
      id: assetId,
      name,
      type: 'audio/wav',
      data: `data:audio/wav;base64,${wav.toString('base64')}`,
    });
    files.push({ name, mimeType: 'audio/wav', buffer: wav });
    hashes[assetId] = createHash('sha256').update(wav).digest('hex');
    lanes.fullMix = { assetId, name, duration, level: 100, muted: true };
    decks.push({
      id,
      title: `Original fixture ${id}`,
      bpm: 120,
      duration,
      gain: 55,
      fader: 100,
      cfSide: 'center',
      fx: { reverb: 0, echo: 0, macro: 0 },
      lanes,
    });
  }
  return {
    files,
    hashes,
    duration,
    project: {
      schema: 'SattariStudio.project.v4',
      sessionName: 'Four Deck Actual Capture QA',
      master: { bpm: 120, level: 50 },
      decks,
      pads: [],
      pianoNotes: [],
      recordings: [],
      arranger: { version: 1, tracks: [], captures: [] },
      assets,
    },
  };
}
function encodeWav(pcm, rate) {
  const bytes = Buffer.alloc(44 + pcm.length * 2);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(pcm.length * 2, 40);
  for (let index = 0; index < pcm.length; index++)
    bytes.writeInt16LE(Math.round(pcm[index] * 32767), 44 + index * 2);
  return bytes;
}
