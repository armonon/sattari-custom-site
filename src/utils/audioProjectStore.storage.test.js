import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubMemoryIndexedDB } from '../test/memoryIndexedDB';
import {
  deleteAudioAssets,
  findIdenticalAsset,
  importAudioAssets,
  listAudioAssets,
  putAudioAsset,
  unusedAudioAssets,
} from './audioProjectStore';

const audio = (text) => new Blob([text], { type: 'audio/wav' });

beforeEach(() => stubMemoryIndexedDB(vi));
afterEach(() => vi.unstubAllGlobals());

describe('audio asset reuse', () => {
  it('stores the same song once when it is loaded again', async () => {
    const first = await putAudioAsset(audio('same song'), { name: 'a.wav', dedupe: true });
    const again = await putAudioAsset(audio('same song'), { name: 'b.wav', dedupe: true });
    const other = await putAudioAsset(audio('same size'), { name: 'c.wav', dedupe: true });
    expect(again.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
    expect(await listAudioAssets()).toHaveLength(2);
  });

  it('keeps recordings unique even when their bytes match', async () => {
    await putAudioAsset(audio('silence'));
    await putAudioAsset(audio('silence'));
    expect(await listAudioAssets()).toHaveLength(2);
  });

  it('compares bytes, not just sizes', async () => {
    const stored = await putAudioAsset(audio('abcd'), { dedupe: true });
    expect(await findIdenticalAsset(audio('abce'))).toBeNull();
    expect((await findIdenticalAsset(audio('abcd')))?.id).toBe(stored.id);
  });

  it('reopening a project reuses audio already on this device', async () => {
    const stored = await putAudioAsset(audio('kick loop'), { dedupe: true });
    const idMap = await importAudioAssets([
      { id: 'project-kick', blob: audio('kick loop'), name: 'kick.wav' },
      { id: 'project-snare', blob: audio('snare loop'), name: 'snare.wav' },
    ]);
    expect(idMap.get('project-kick')).toBe(stored.id);
    expect(idMap.get('project-snare')).not.toBe(stored.id);
    expect(await listAudioAssets()).toHaveLength(2);
  });
});

describe('unused audio', () => {
  const hour = 60 * 60 * 1000;

  it('lists only unreferenced audio stored before the grace window', async () => {
    const now = Date.now();
    vi.useFakeTimers({ now: now - 2 * hour, toFake: ['Date'] });
    const kept = await putAudioAsset(audio('kept'));
    const unused = await putAudioAsset(audio('unused'));
    vi.useRealTimers();
    const fresh = await putAudioAsset(audio('still being saved'));
    const result = await unusedAudioAssets([kept.id], { now });
    expect(result.map((asset) => asset.id)).toEqual([unused.id]);
    expect(result[0]).not.toHaveProperty('blob');
    expect((await listAudioAssets()).map((asset) => asset.id)).toContain(fresh.id);
  });

  it('treats freshly imported audio as recent even when its project is old', async () => {
    const idMap = await importAudioAssets([
      { id: 'old', blob: audio('from 2024'), createdAt: '2024-01-01T00:00:00.000Z' },
    ]);
    expect(idMap.get('old')).toBeTruthy();
    expect(await unusedAudioAssets([])).toEqual([]);
  });

  it('deletes exactly the requested assets', async () => {
    const a = await putAudioAsset(audio('a'));
    const b = await putAudioAsset(audio('b'));
    const c = await putAudioAsset(audio('c'));
    await deleteAudioAssets([a.id, c.id, a.id, '']);
    expect((await listAudioAssets()).map((asset) => asset.id)).toEqual([b.id]);
    await deleteAudioAssets([]);
    expect(await listAudioAssets()).toHaveLength(1);
  });
});

describe('persistent storage', () => {
  it('asks the browser to keep audio once, only when audio is first stored', async () => {
    vi.resetModules();
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: { persisted: async () => false, persist },
    });
    const store = await import('./audioProjectStore');
    expect(persist).not.toHaveBeenCalled();
    await store.putAudioAsset(audio('one'));
    await store.putAudioAsset(audio('two'));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when storage is already persistent', async () => {
    vi.resetModules();
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { ...navigator, storage: { persisted: async () => true, persist } });
    const store = await import('./audioProjectStore');
    expect(await store.requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });
});
