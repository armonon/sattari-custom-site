/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blobToDataUrl,
  dataUrlToBlob,
  putAudioAsset,
  importAudioAssets,
  listAudioAssets,
  exportAudioAssets,
  loadStudioSession,
  saveStudioSession,
  SESSION_KEY,
  validateStudioProject,
} from './audioProjectStore';
import { stubMemoryIndexedDB } from '../test/memoryIndexedDB';

afterEach(() => vi.unstubAllGlobals());

function fakeDatabase(result) {
  const request = { result };
  const store = { put: vi.fn(() => request), get: vi.fn(() => request) };
  const transaction = { objectStore: () => store };
  const database = { transaction: () => transaction, close: vi.fn() };
  const open = vi.fn(() => {
    const opening = { result: database };
    queueMicrotask(() => opening.onsuccess());
    return opening;
  });
  vi.stubGlobal('indexedDB', { open });
  return { request, transaction, database, store, open };
}

describe('portable audio assets', () => {
  it.each([
    { hotCues: [{ unexpected: true }] },
    { stemFx: { vocals: { pitch: 'broken' } } },
    { arrangement: { start: Infinity } },
    { arrangement: { automation: { volume: 'broken' } } },
    { arrangement: { automation: { volume: [null] } } },
    { arrangement: { automation: { volume: [{ position: 0 }] } } },
  ])('rejects damaged nested editing state: %j', (deck) => {
    expect(() => validateStudioProject({ decks: [deck] })).toThrow('invalid settings');
  });

  it.each([2, 3, 4])('accepts editing data from portable project v%i', (version) => {
    expect(() =>
      validateStudioProject({
        schema: `SattariStudio.project.v${version}`,
        decks: [
          {
            title: 'Legacy',
            hotCues: [0, null, 2],
            arrangement: {
              start: 3,
              trimStart: 1,
              trimEnd: 8,
              automation: {
                volume: [
                  { position: 0, value: 80 },
                  { position: 1, value: 100 },
                ],
              },
            },
          },
        ],
      })
    ).not.toThrow();
  });
  it('rejects invalid project settings before replacing the current audio graph', () => {
    expect(() => validateStudioProject({ decks: [{ title: { invalid: true } }] })).toThrow(
      'invalid settings'
    );
    expect(() => validateStudioProject({ decks: [{ bpm: 'fast' }] })).toThrow('invalid settings');
    expect(() => validateStudioProject({ decks: [], pianoNotes: [null] })).toThrow(
      'invalid settings'
    );
    expect(() =>
      validateStudioProject({ decks: [{ title: 'Legacy track', bpm: 120 }], pianoNotes: [] })
    ).not.toThrow();
  });
  it('preserves malformed and future saved projects instead of treating them as empty', () => {
    for (const value of ['{broken', JSON.stringify({ schema: 'SattariStudio.session.v99' })]) {
      localStorage.setItem(SESSION_KEY, value);
      expect(() => loadStudioSession()).toThrow();
      expect(localStorage.getItem(SESSION_KEY)).toBe(value);
    }
    localStorage.removeItem(SESSION_KEY);
  });

  it('does not claim an autosave succeeded when browser storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveStudioSession({})).toThrow('unavailable');
  });
  it('round-trips an embedded audio blob without losing its type or bytes', async () => {
    const original = new Blob([new Uint8Array([12, 42, 128, 255])], { type: 'audio/wav' });
    const encoded = await blobToDataUrl(original);
    const restored = dataUrlToBlob(encoded);

    expect(restored.type).toBe('audio/wav');
    expect(Array.from(new Uint8Array(await restored.arrayBuffer()))).toEqual([12, 42, 128, 255]);
  });

  it('rejects damaged embedded asset data', () => {
    expect(() => dataUrlToBlob('not-a-data-url')).toThrow('damaged audio asset');
  });

  it('does not report a successful save until the transaction commits', async () => {
    const { transaction, request, database } = fakeDatabase('asset-id');
    let settled = false;
    const saving = putAudioAsset(new Blob(['sample'])).then((value) => {
      settled = true;
      return value;
    });
    await vi.waitFor(() => expect(transaction.oncomplete).toBeTypeOf('function'));
    request.onsuccess?.();
    await Promise.resolve();
    expect(settled).toBe(false);
    transaction.oncomplete();
    await saving;
    expect(database.close).toHaveBeenCalledOnce();
  });

  it('surfaces a late storage abort instead of claiming the take is saved', async () => {
    const { transaction } = fakeDatabase('asset-id');
    const saving = putAudioAsset(new Blob(['sample']));
    const failure = expect(saving).rejects.toThrow('disk full');
    await vi.waitFor(() => expect(transaction.onabort).toBeTypeOf('function'));
    transaction.error = new Error('disk full');
    transaction.onabort();
    await failure;
  });

  it('rejects a damaged import before writing any audio', async () => {
    const { store } = fakeDatabase();
    await expect(
      importAudioAssets([
        { id: 'a', data: 'data:audio/wav;base64,AQ==' },
        { id: 'b', data: 'broken' },
      ])
    ).rejects.toThrow('damaged');
    expect(store.put).not.toHaveBeenCalled();
  });

  it('imports audio with new identities, writing nothing if any record is invalid', async () => {
    stubMemoryIndexedDB(vi);
    const mapping = await importAudioAssets([
      { id: 'existing', data: 'data:audio/wav;base64,AQ==' },
    ]);
    const stored = await listAudioAssets();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).not.toBe('existing');
    expect(mapping.get('existing')).toBe(stored[0].id);
    await expect(
      importAudioAssets([{ id: 'next', data: 'data:audio/wav;base64,Ag==' }, { id: 'broken' }])
    ).rejects.toThrow('invalid or duplicate audio asset');
    expect(await listAudioAssets()).toHaveLength(1);
  });

  it('does not silently omit missing audio from a portable backup', async () => {
    const { transaction } = fakeDatabase(undefined);
    const exporting = exportAudioAssets(['missing']);
    const failure = expect(exporting).rejects.toThrow('Project audio is missing');
    await vi.waitFor(() => expect(transaction.oncomplete).toBeTypeOf('function'));
    transaction.oncomplete();
    await failure;
  });
});
