import { Blob as NodeBlob, Buffer } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { afterEach, it, expect, vi } from 'vitest';
import { getAudioAsset } from './audioProjectStore';
import { createExportSink } from './arrangementStreamExport';
import { readProjectArchive, writeProjectArchive } from './projectArchive';
vi.mock('./audioProjectStore', () => ({ getAudioAsset: vi.fn(), validateStudioProject: vi.fn() }));
vi.mock('./arrangementStreamExport', () => ({ createExportSink: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
async function archive() {
  vi.stubGlobal('crypto', webcrypto);
  const writes = [];
  createExportSink.mockResolvedValue({
    write: async (bytes) => writes.push(bytes),
    finish: async () => new NodeBlob(writes),
    abort: vi.fn(),
  });
  getAudioAsset.mockResolvedValue({
    id: 'source',
    name: 'take.wav',
    blob: new NodeBlob([new Uint8Array(3 * 1024 * 1024 + 7)]),
  });
  return {
    file: await writeProjectArchive({ decks: [], sessionName: 'Set' }, ['source', 'source']),
    writes,
  };
}
it('streams binary audio in bounded pieces and reopens without base64 expansion', async () => {
  const { file, writes } = await archive();
  expect(Math.max(...writes.map((part) => part.byteLength))).toBeLessThanOrEqual(1048576);
  const read = await readProjectArchive(file);
  expect(read.sessionName).toBe('Set');
  expect(read.assets).toHaveLength(1);
  expect(read.assets[0].blob.size).toBe(3 * 1024 * 1024 + 7);
  expect(read.assets[0].data).toBeUndefined();
});
it('rejects truncated and corrupted archives before importing any assets', async () => {
  const { file } = await archive();
  await expect(readProjectArchive(file.slice(0, file.size - 1))).rejects.toThrow(/Damaged/);
  const damaged = new NodeBlob([file.slice(0, file.size - 1), new Uint8Array([12])]);
  await expect(readProjectArchive(damaged)).rejects.toThrow(/audio is damaged/);
});
it('still reads older JSON projects', async () => {
  const project = { schema: 'SattariStudio.project.v5', decks: [], assets: [] };
  expect(await readProjectArchive(new NodeBlob([JSON.stringify(project)]))).toEqual(project);
});
it('still saves a backup when there is no temporary disk space, without copying audio', async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('Blob', NodeBlob);
  createExportSink.mockRejectedValue(new Error('Not enough browser disk space for this export.'));
  const audio = new NodeBlob([new Uint8Array(2 * 1024 * 1024 + 3).fill(7)]);
  getAudioAsset.mockResolvedValue({ id: 'source', name: 'take.wav', blob: audio });
  const progress = vi.fn();
  const file = await writeProjectArchive(
    { decks: [], sessionName: 'Full disk' },
    ['source'],
    progress
  );
  expect(progress).toHaveBeenCalledWith('Saving audio 1 / 1');
  const read = await readProjectArchive(file);
  expect(read.sessionName).toBe('Full disk');
  const restored = Buffer.from(await read.assets[0].blob.arrayBuffer());
  expect(restored.equals(Buffer.from(await audio.arrayBuffer()))).toBe(true);
});
