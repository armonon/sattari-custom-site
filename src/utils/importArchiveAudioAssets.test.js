import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { importAudioAssets } from './audioProjectStore';
import { createExportSink, clearExportFile } from './arrangementStreamExport';
import { hashLibraryAudio } from './libraryFiles';
import { importArchiveAudioAssets } from './importArchiveAudioAssets';
vi.mock('./audioProjectStore', () => ({ importAudioAssets: vi.fn() }));
vi.mock('./arrangementStreamExport', () => ({
  createExportSink: vi.fn(),
  clearExportFile: vi.fn(),
}));
let writes, abort;
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  writes = [];
  abort = vi.fn(async () => {});
  createExportSink.mockImplementation(async () => {
    const parts = [];
    return {
      write: async (bytes) => {
        parts.push(bytes);
        writes.push(bytes);
      },
      finish: async () => new NodeBlob(parts),
      abort,
    };
  });
  importAudioAssets.mockResolvedValue(new Map([['a', 'new-id']]));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
const record = async (blob) => ({ id: 'a', blob, hash: await hashLibraryAudio(blob) });
it('detaches exact bytes in bounded reads and verifies stored hashes before returning', async () => {
  const blob = new NodeBlob([new Uint8Array(3 * 1048576 + 7).fill(19)]);
  const r = await record(blob);
  expect(await importArchiveAudioAssets([r])).toEqual(new Map([['a', 'new-id']]));
  expect(Math.max(...writes.map((b) => b.byteLength))).toBe(1048576);
  const staged = importAudioAssets.mock.calls[0][0][0];
  expect(staged.blob).not.toBe(blob);
  expect(await hashLibraryAudio(staged.blob)).toBe(r.hash);
  expect(importAudioAssets).toHaveBeenCalledWith([staged], { verifyHashes: true });
  expect(clearExportFile).toHaveBeenCalledWith(staged.blob);
});
it('refuses aggregate-large memory staging before importing any database records', async () => {
  const blob = new NodeBlob([new Uint8Array(17 * 1048576)]);
  const r = await record(blob);
  createExportSink.mockRejectedValue(new Error('temporary disk refused'));
  await expect(importArchiveAudioAssets([r, { ...r, id: 'b' }])).rejects.toThrow(/refused/);
  expect(createExportSink).toHaveBeenCalledWith(blob.size, 'wav', { allowMemoryFallback: false });
  expect(importAudioAssets).not.toHaveBeenCalled();
});
it('rejects short reads before writing or importing', async () => {
  const blob = { size: 100, slice: () => ({ arrayBuffer: async () => new ArrayBuffer(1) }) };
  await expect(importArchiveAudioAssets([{ id: 'a', blob, hash: 'unused' }])).rejects.toThrow(
    /byte range/
  );
  expect(writes).toHaveLength(0);
  expect(abort).toHaveBeenCalledOnce();
  expect(importAudioAssets).not.toHaveBeenCalled();
});
it('rejects wrong staged bytes and cleans temporary files without importing', async () => {
  const r = await record(new NodeBlob(['correct']));
  const wrong = new NodeBlob(['incorrect']);
  createExportSink.mockResolvedValue({ write: vi.fn(), finish: async () => wrong, abort });
  await expect(importArchiveAudioAssets([r])).rejects.toThrow(/verification/);
  expect(importAudioAssets).not.toHaveBeenCalled();
  expect(abort).toHaveBeenCalledOnce();
  expect(clearExportFile).not.toHaveBeenCalled();
});
it('cleans every staged file after database rejection', async () => {
  const a = await record(new NodeBlob(['one']));
  const b = { ...(await record(new NodeBlob(['two']))), id: 'b' };
  importAudioAssets.mockRejectedValue(new Error('quota abort'));
  await expect(importArchiveAudioAssets([a, b])).rejects.toThrow(/quota/);
  expect(clearExportFile).toHaveBeenCalledTimes(2);
});
it('rejects oversized hash reads rather than accepting a misleading range', async () => {
  await expect(
    hashLibraryAudio({ size: 2, slice: () => ({ arrayBuffer: async () => new ArrayBuffer(3) }) })
  ).rejects.toThrow(/byte range/);
});

it('attempts all temporary cleanups and does not mask a database failure', async () => {
  const a = await record(new NodeBlob(['one']));
  const b = { ...(await record(new NodeBlob(['two']))), id: 'b' };
  importAudioAssets.mockRejectedValue(new Error('quota abort'));
  clearExportFile.mockRejectedValueOnce(
    Object.assign(new Error('already gone'), { name: 'NotFoundError' })
  );
  await expect(importArchiveAudioAssets([a, b])).rejects.toThrow(/quota abort/);
  expect(clearExportFile).toHaveBeenCalledTimes(2);
});
it('does not report a verified import as failed solely because cleanup failed', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  clearExportFile.mockRejectedValue(new Error('disk cleanup denied'));
  const a = await record(new NodeBlob(['one']));
  expect(await importArchiveAudioAssets([a])).toEqual(new Map([['a', 'new-id']]));
  expect(warn).toHaveBeenCalledOnce();
  warn.mockRestore();
});
