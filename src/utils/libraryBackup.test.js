import { beforeEach, expect, it, vi } from 'vitest';
import { exportLibraryBackup, readLibraryBackup, restoreLibraryBackup } from './libraryBackup';
import {
  listLibraryTracks,
  getLibraryAudio,
  importLibraryTrack,
  updateLibraryTrack,
} from './musicLibrary';
import { libraryOrganization } from './libraryOrganization';
vi.mock('./musicLibrary', () => ({
  listLibraryTracks: vi.fn(),
  getLibraryAudio: vi.fn(),
  importLibraryTrack: vi.fn(),
  updateLibraryTrack: vi.fn(),
}));
vi.mock('./libraryOrganization', () => ({ libraryOrganization: vi.fn() }));
const track = {
  id: 'old',
  name: 'song.wav',
  path: 'Album/song.wav',
  title: 'Song',
  album: 'Album',
  artist: 'Artist',
  favorite: true,
  albumArtist: 'Album artist',
  trackNumber: 2,
  analysis: { bpm: 120, key: 'C major' },
};
beforeEach(() => {
  vi.clearAllMocks();
  listLibraryTracks.mockResolvedValue([track]);
  getLibraryAudio.mockResolvedValue(new Blob(['audio']));
  libraryOrganization.mockResolvedValue({
    playlists: [{ id: 'set', name: 'Set', tracks: ['old'] }],
    queue: [{ id: 'q', trackId: 'old' }],
  });
  importLibraryTrack.mockResolvedValue({ track: { id: 'new' }, duplicate: false });
});
it('round-trips original audio, metadata and remapped playlist / queue references', async () => {
  const archive = await exportLibraryBackup();
  const parsed = await readLibraryBackup(archive);
  expect(parsed.entries[0].track.title).toBe('Song');
  expect(parsed.entries[0].blob.size).toBe(5);
  expect(await restoreLibraryBackup(archive)).toBe(1);
  expect(updateLibraryTrack).toHaveBeenCalledWith(
    'new',
    expect.objectContaining({
      title: 'Song',
      artist: 'Artist',
      favorite: true,
      albumArtist: 'Album artist',
      trackNumber: 2,
      analysis: { bpm: 120, key: 'C major' },
    })
  );
  expect(libraryOrganization).toHaveBeenLastCalledWith({
    type: 'merge',
    organization: {
      playlists: [{ name: 'Set', tracks: ['new'] }],
      queue: [{ id: 'q', trackId: 'new' }],
    },
  });
});
it('rejects damaged / truncated backups before modifying the library', async () => {
  const archive = await exportLibraryBackup();
  const damaged = new Blob([archive.slice(0, archive.size - 5), 'wrong']);
  await expect(restoreLibraryBackup(damaged)).rejects.toThrow('damaged');
  await expect(restoreLibraryBackup(archive.slice(0, archive.size - 1))).rejects.toThrow(
    'Invalid song'
  );
  expect(importLibraryTrack).not.toHaveBeenCalled();
});
it('does not create incomplete backups or overwrite metadata for existing audio', async () => {
  getLibraryAudio.mockResolvedValueOnce(null);
  await expect(exportLibraryBackup()).rejects.toThrow('audio missing');
  const archive = await exportLibraryBackup();
  importLibraryTrack.mockResolvedValue({ track: { id: 'existing' }, duplicate: true });
  await restoreLibraryBackup(archive);
  expect(updateLibraryTrack).not.toHaveBeenCalled();
});
it('supports cancellation before writing restored songs', async () => {
  const archive = await exportLibraryBackup();
  await expect(restoreLibraryBackup(archive, undefined, () => true)).rejects.toThrow('Stopped');
  expect(importLibraryTrack).not.toHaveBeenCalled();
});
