import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashLibraryAudio } from './libraryFiles';
import {
  droppedLibraryFiles,
  getLibraryAudio,
  importLibraryTrack,
  isLibraryAudio,
  libraryMetadata,
  listLibraryTracks,
  saveLibraryAnalysis,
  selectLibraryTracks,
} from './musicLibrary';

afterEach(() => vi.unstubAllGlobals());
const file = (name = '02 Song.wav') =>
  new File(['audio'], name, { type: 'audio/wav', lastModified: 100 });

describe('music library organization', () => {
  it('groups nested albums by folder and recognizes track numbers', () => {
    const metadata = libraryMetadata(file(), 'Artist/Album/02 Song.wav');
    expect(metadata).toMatchObject({
      title: '02 Song',
      album: 'Album',
      folder: 'Artist/Album',
      trackNumber: 2,
    });
    expect(libraryMetadata(file(), metadata.path).fingerprint).toBe(metadata.fingerprint);
    expect(libraryMetadata(file(), 'Other/02 Song.wav').fingerprint).not.toBe(metadata.fingerprint);
  });
  it('filters cover art and accepts audio with missing MIME types', () => {
    expect(isLibraryAudio({ name: 'song.FLAC', type: '' })).toBe(true);
    expect(isLibraryAudio({ name: 'cover.jpg', type: 'image/jpeg' })).toBe(false);
  });
  it('searches folders, BPM and key; sorts known BPM before unknown without mutating input', () => {
    const tracks = [
      { ...libraryMetadata(file('10 Song.wav'), 'Album/10 Song.wav'), analysis: null },
      {
        ...libraryMetadata(file('02 Song.wav'), 'Album/02 Song.wav'),
        analysis: { bpm: 120, key: 'A minor' },
      },
      {
        ...libraryMetadata(file('01 Song.wav'), 'Else/01 Song.wav'),
        analysis: { bpm: 90, key: 'C major' },
      },
    ];
    expect(selectLibraryTracks(tracks, { query: 'minor' })).toHaveLength(1);
    expect(selectLibraryTracks(tracks, { query: '120' })).toHaveLength(1);
    expect(
      selectLibraryTracks(tracks, { folder: 'Album', sort: 'album' }).map((t) => t.trackNumber)
    ).toEqual([2, 10]);
    expect(selectLibraryTracks(tracks, { sort: 'bpm' }).map((t) => t.analysis?.bpm)).toEqual([
      90,
      120,
      undefined,
    ]);
    expect(tracks[0].trackNumber).toBe(10);
  });
  it('drains directory batches and preserves nested paths', async () => {
    const entry = (name) => ({ name, isFile: true, file: (resolve) => resolve(file(name)) });
    const folder = (name, batches) => ({
      name,
      isDirectory: true,
      createReader: () => ({ readEntries: (resolve) => resolve(batches.shift() || []) }),
    });
    const album = folder('Album', [[entry('01.wav')], [folder('Disc 2', [[entry('02.wav')]])]]);
    const result = await droppedLibraryFiles({
      items: [{ webkitGetAsEntry: () => album }],
      files: [],
    });
    expect(result.map((item) => item.path)).toEqual(['Album/01.wav', 'Album/Disc 2/02.wav']);
  });
  it('supports ordinary file drops and reports unreadable folders', async () => {
    expect(await droppedLibraryFiles({ files: [file()] })).toHaveLength(1);
    const folder = {
      isDirectory: true,
      createReader: () => ({ readEntries: (_, reject) => reject(new Error('Access denied')) }),
    };
    await expect(
      droppedLibraryFiles({ items: [{ webkitGetAsEntry: () => folder }] })
    ).rejects.toThrow('Access denied');
  });
});

function database() {
  const requests = [];
  const request = (result) => {
    const value = { result };
    requests.push(value);
    return value;
  };
  const tracks = {
    getAll: vi.fn(() => request([])),
    get: vi.fn(() => request(null)),
    put: vi.fn(),
    index: () => ({ get: vi.fn(() => request(null)) }),
  };
  const audio = { get: vi.fn(() => request(null)), put: vi.fn() };
  const tx = { objectStore: (name) => (name === 'tracks' ? tracks : audio) };
  const db = { transaction: vi.fn(() => tx), close: vi.fn() };
  const open = vi.fn(() => {
    const value = { result: db };
    queueMicrotask(() => value.onsuccess());
    return value;
  });
  vi.stubGlobal('indexedDB', { open });
  return { requests, tracks, audio, tx, db, open };
}

async function noLegacy(mock) {
  await vi.waitFor(() => expect(mock.requests).toHaveLength(1));
  mock.requests[0].onsuccess();
  mock.tx.oncomplete();
  mock.requests.length = 0;
}
describe('music library durable storage', () => {
  it('atomically writes audio and metadata and only resolves after commit', async () => {
    const mock = database();
    let complete = false;
    const importing = importLibraryTrack(file()).then((value) => {
      complete = true;
      return value;
    });
    await noLegacy(mock);
    await vi.waitFor(() => expect(mock.requests).toHaveLength(1));
    mock.requests[0].onsuccess();
    await Promise.resolve();
    expect(complete).toBe(false);
    expect(mock.tracks.put).toHaveBeenCalledOnce();
    expect(mock.audio.put).toHaveBeenCalledOnce();
    mock.tx.oncomplete();
    expect(await importing).toMatchObject({ duplicate: false });
    expect(mock.open).toHaveBeenCalledWith('sattari-music-library-v1', 1);
    expect(mock.db.close).toHaveBeenCalledTimes(2);
  });
  it('deduplicates and repairs audio when reimporting the same source', async () => {
    const mock = database();
    const original = libraryMetadata(file());
    const importing = importLibraryTrack(file());
    await noLegacy(mock);
    await vi.waitFor(() => expect(mock.requests).toHaveLength(1));
    mock.requests[0].result = original;
    mock.requests[0].onsuccess();
    mock.requests[1].onsuccess();
    mock.tx.oncomplete();
    expect(await importing).toEqual({ track: original, duplicate: true });
    expect(mock.tracks.put).not.toHaveBeenCalled();
    expect(mock.audio.put.mock.calls[0][0].id).toBe(original.id);
  });
  it('never overwrites healthy duplicate audio', async () => {
    const mock = database();
    const original = libraryMetadata(file());
    const importing = importLibraryTrack(file());
    await noLegacy(mock);
    await vi.waitFor(() => expect(mock.requests).toHaveLength(1));
    mock.requests[0].result = original;
    mock.requests[0].onsuccess();
    mock.requests[1].result = { blob: file() };
    mock.requests[1].onsuccess();
    mock.tx.oncomplete();
    expect(await importing).toEqual({ track: original, duplicate: true });
    expect(mock.audio.put).not.toHaveBeenCalled();
  });
  it('upgrades matching legacy entries without breaking playlist IDs or overwriting user tags', async () => {
    const mock = database();
    const original = { ...libraryMetadata(file()), title: 'My custom title' };
    const importing = importLibraryTrack(file());
    await vi.waitFor(() => expect(mock.requests).toHaveLength(1));
    mock.requests[0].result = original;
    mock.requests[0].onsuccess();
    mock.requests[1].result = { blob: file() };
    mock.requests[1].onsuccess();
    mock.tx.oncomplete();
    mock.requests.length = 0;
    await vi.waitFor(() => expect(mock.requests).toHaveLength(1));
    mock.requests[0].onsuccess();
    mock.requests[1].result = original;
    mock.requests[1].onsuccess();
    mock.tx.oncomplete();
    expect(await importing).toMatchObject({
      duplicate: true,
      track: { id: original.id, title: 'My custom title' },
    });
    expect(mock.audio.put).not.toHaveBeenCalled();
    expect(mock.tracks.put.mock.calls[0][0].fingerprint).toMatch(/^audio-tree-v1:/);
  });
  it('distinguishes audio with identical names, sizes and dates by content', async () => {
    const a = new File(['AAAA'], 'song.wav', { lastModified: 100 });
    const b = new File(['BBBB'], 'song.wav', { lastModified: 100 });
    expect(libraryMetadata(a).fingerprint).toBe(libraryMetadata(b).fingerprint);
    expect(await hashLibraryAudio(a)).not.toBe(await hashLibraryAudio(b));
    expect(await hashLibraryAudio(a)).toBe(
      await hashLibraryAudio(new File(['AAAA'], 'renamed.wav'))
    );
  });
  it('reports failed commits instead of claiming an import succeeded', async () => {
    const mock = database();
    const importing = importLibraryTrack(file());
    const failure = expect(importing).rejects.toThrow('Full');
    await noLegacy(mock);
    await vi.waitFor(() => expect(mock.requests).toHaveLength(1));
    mock.requests[0].onsuccess();
    mock.tx.error = new DOMException('Full', 'QuotaExceededError');
    mock.tx.onabort();
    await failure;
  });
  it('lists metadata without loading audio blobs', async () => {
    const mock = database();
    const listing = listLibraryTracks();
    await vi.waitFor(() => expect(mock.requests).toHaveLength(1));
    mock.requests[0].onsuccess();
    mock.tx.oncomplete();
    expect(await listing).toEqual([]);
    expect(mock.audio.get).not.toHaveBeenCalled();
  });
  it('reads one requested audio asset and persists analyzed metadata', async () => {
    const mock = database();
    const reading = getLibraryAudio('song');
    await vi.waitFor(() => expect(mock.requests).toHaveLength(1));
    mock.requests[0].result = { blob: file() };
    mock.requests[0].onsuccess();
    mock.tx.oncomplete();
    expect((await reading).name).toBe('02 Song.wav');
    const saving = saveLibraryAnalysis('song', { bpm: 120 });
    await vi.waitFor(() => expect(mock.requests).toHaveLength(2));
    mock.requests[1].result = { id: 'song' };
    mock.requests[1].onsuccess();
    mock.tx.oncomplete();
    expect(await saving).toEqual({ id: 'song', analysis: { bpm: 120 } });
  });
});
