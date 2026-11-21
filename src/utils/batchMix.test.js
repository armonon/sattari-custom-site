import { expect, it } from 'vitest';
import { wavBytes } from './arrangementExport';
import { parseWav } from './stemMix';
import { renderBatchMixes } from './batchMix';

const wav = (value, frames = 100) => {
  const data = new Float32Array(frames).fill(value);
  return new Blob([
    wavBytes(
      { numberOfChannels: 2, length: frames, sampleRate: 44100, getChannelData: () => data },
      true
    ),
  ]);
};
const job = (name, ids = ['vocals', 'drums', 'bass', 'other']) => ({
  file: { name },
  outputs: ids.map((id, i) => ({ id, blob: wav([0.1, 0.02, 0.004, 0.0008][i]) })),
});

it('renders the same preset for every song and skips songs missing parts', async () => {
  const { mixes, skipped } = await renderBatchMixes(
    [job('one'), job('two'), job('partial', ['vocals'])],
    'no-drums'
  );
  expect(mixes.map((mix) => mix.name)).toEqual(['one-drumless-mix.wav', 'two-drumless-mix.wav']);
  expect(skipped).toEqual(['partial']);
  const parsed = parseWav(await mixes[1].blob.arrayBuffer());
  expect(parsed.channels[0][50]).toBeCloseTo(0.1 + 0.004 + 0.0008, 6);
});
