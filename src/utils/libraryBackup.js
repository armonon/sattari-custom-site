import {
  getLibraryAudio,
  importLibraryTrack,
  listLibraryTracks,
  updateLibraryTrack,
} from './musicLibrary';
import { libraryOrganization } from './libraryOrganization';
import { hashLibraryAudio, readBlob } from './libraryFiles';

const MAGIC = 'SATTLIB1';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function restoredAnalysis(value) {
  if (!value || typeof value !== 'object') return undefined;
  const result = {};
  if (Number.isFinite(value.bpm) && value.bpm >= 20 && value.bpm <= 400) result.bpm = value.bpm;
  if (typeof value.key === 'string') result.key = value.key.slice(0, 40);
  if (
    Array.isArray(value.waveform) &&
    value.waveform.length <= 1024 &&
    value.waveform.every((item) => Number.isFinite(item) && item >= 0 && item <= 100)
  )
    result.waveform = value.waveform;
  for (const key of ['duration', 'sampleRate', 'channels', 'rmsDb', 'peakDb'])
    if (Number.isFinite(value[key])) result[key] = value[key];
  if (value.source === 'manual') result.source = 'manual';
  return Object.keys(result).length ? result : undefined;
}
const checkCancelled = (cancelled) => {
  if (cancelled?.())
    throw new Error('Stopped. Any songs already restored are kept; retrying skips matching audio.');
};

export async function exportLibraryBackup(progress = () => {}, cancelled) {
  const tracks = await listLibraryTracks();
  const organization = await libraryOrganization();
  const entries = [],
    audio = [];
  for (const [index, track] of tracks.entries()) {
    checkCancelled(cancelled);
    progress(`Backing up ${index + 1}/${tracks.length}: ${track.title}`);
    const blob = await getLibraryAudio(track.id);
    if (!blob)
      throw new Error(
        `Backup not created: audio missing for ${track.title}. Reimport its original first.`
      );
    entries.push({ ...track, bytes: blob.size, hash: await hashLibraryAudio(blob) });
    audio.push(blob);
  }
  checkCancelled(cancelled);
  const manifest = encoder.encode(
    JSON.stringify({ format: MAGIC, version: 1, tracks: entries, organization })
  );
  if (manifest.length > 8 * 1024 * 1024)
    throw new Error('Library manifest is too large for this backup format.');
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, manifest.length, true);
  return new Blob([encoder.encode(MAGIC), length, manifest, ...audio], {
    type: 'application/octet-stream',
  });
}

export async function readLibraryBackup(file) {
  const header = await readBlob(file.slice(0, 12));
  if (header.byteLength !== 12 || decoder.decode(new Uint8Array(header, 0, 8)) !== MAGIC)
    throw new Error('Not a Sattari library backup.');
  const length = new DataView(header).getUint32(8, true);
  if (!length || length > 8 * 1024 * 1024 || 12 + length > file.size)
    throw new Error('Invalid library backup header.');
  const manifest = JSON.parse(decoder.decode(await readBlob(file.slice(12, 12 + length))));
  if (
    manifest.format !== MAGIC ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.tracks) ||
    manifest.tracks.length > 10000
  )
    throw new Error('Unsupported library backup.');
  const ids = new Set();
  let offset = 12 + length;
  const entries = manifest.tracks.map((track) => {
    if (
      !track ||
      typeof track.id !== 'string' ||
      ids.has(track.id) ||
      typeof track.name !== 'string' ||
      typeof track.path !== 'string' ||
      typeof track.title !== 'string' ||
      !Number.isSafeInteger(track.bytes) ||
      track.bytes < 0 ||
      track.bytes > file.size - offset ||
      !/^audio-tree-v1:\d+:[a-f0-9]{64}$/.test(track.hash)
    )
      throw new Error('Invalid song entry in library backup.');
    ids.add(track.id);
    const blob = file.slice(
      offset,
      offset + track.bytes,
      typeof track.type === 'string' ? track.type : ''
    );
    offset += track.bytes;
    return { track, blob };
  });
  if (offset !== file.size) throw new Error('Library backup has missing or unexpected audio data.');
  const organization = manifest.organization;
  if (
    !organization ||
    !Array.isArray(organization.playlists) ||
    !Array.isArray(organization.queue) ||
    organization.playlists.some(
      (item) =>
        !item ||
        typeof item.name !== 'string' ||
        !Array.isArray(item.tracks) ||
        item.tracks.some((id) => !ids.has(id))
    ) ||
    organization.queue.some(
      (item) => !item || typeof item.id !== 'string' || !ids.has(item.trackId)
    )
  )
    throw new Error('Invalid playlist or queue references in library backup.');
  return { entries, organization };
}

export async function restoreLibraryBackup(file, progress = () => {}, cancelled) {
  const { entries, organization } = await readLibraryBackup(file);
  // Verify every byte before any writes. Storage/quota failures during the
  // subsequent merge retain successful imports, never erase the current library.
  for (const [index, { track, blob }] of entries.entries()) {
    checkCancelled(cancelled);
    progress(`Checking backup ${index + 1}/${entries.length}: ${track.title}`);
    if ((await hashLibraryAudio(blob)) !== track.hash)
      throw new Error(`Backup audio is damaged: ${track.title}. Nothing was restored.`);
  }
  const mapping = new Map();
  for (const [index, { track, blob }] of entries.entries()) {
    checkCancelled(cancelled);
    progress(`Restoring ${index + 1}/${entries.length}: ${track.title}`);
    const result = await importLibraryTrack(
      new File([blob], track.name, { type: blob.type }),
      track.path
    );
    mapping.set(track.id, result.track.id);
    if (!result.duplicate)
      await updateLibraryTrack(result.track.id, {
        title: track.title,
        artist: track.artist,
        album: track.album,
        albumArtist: track.albumArtist,
        genre: track.genre,
        favorite: track.favorite,
        trackNumber: track.trackNumber,
        discNumber: track.discNumber,
        year: track.year,
        trashedAt: typeof track.trashedAt === 'string' ? track.trashedAt : null,
        analysis: restoredAnalysis(track.analysis),
      });
  }
  checkCancelled(cancelled);
  await libraryOrganization({
    type: 'merge',
    organization: {
      playlists: organization.playlists.map((item) => ({
        name: item.name.slice(0, 80),
        tracks: [...new Set(item.tracks.map((id) => mapping.get(id)))],
      })),
      queue: organization.queue.map((item) => ({
        id: item.id,
        trackId: mapping.get(item.trackId),
      })),
    },
  });
  return entries.length;
}

export function downloadLibraryFile(blob, filename) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
