import { hashLibraryAudio, LIBRARY_DRAG_TYPE } from './libraryFiles';
import { readLibraryTags } from './libraryTags';
// Separate from session assets: starting/opening a project never clears music.
const DB_NAME = 'sattari-music-library-v1';
const AUDIO_EXTENSION = /\.(mp3|wav|wave|aif|aiff|flac|m4a|aac|ogg|oga|opus|webm|mp4)$/i;

function openLibrary() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB)
      return reject(new Error('Music library storage is unavailable in this browser.'));
    const request = indexedDB.open(DB_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      const tracks = db.createObjectStore('tracks', { keyPath: 'id' });
      tracks.createIndex('fingerprint', 'fingerprint', { unique: true });
      db.createObjectStore('audio', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error('Could not open the music library.'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close other Studio tabs and try opening the library again.'));
    };
  });
}

async function transaction(mode, operation) {
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['tracks', 'audio'], mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () =>
        reject(tx.error || new Error('Library storage failed. Check available browser storage.'));
      operation(tx, (value) => {
        result = value;
      });
    });
  } finally {
    db.close();
  }
}

export function isLibraryAudio(file) {
  return Boolean(
    file && (file.type?.startsWith('audio/') || AUDIO_EXTENSION.test(file.name || ''))
  );
}

export function libraryMetadata(file, relativePath = file.webkitRelativePath || file.name) {
  const path = relativePath.replaceAll('\\', '/');
  const parts = path.split('/').filter(Boolean);
  const title = file.name.replace(/\.[^.]+$/, '');
  return {
    id: `music-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
    fingerprint: JSON.stringify([path, file.size, file.lastModified || 0]),
    title,
    name: file.name,
    path,
    album: parts.length > 1 ? parts[parts.length - 2] : 'Unfiled',
    artist: parts.length > 2 ? parts[parts.length - 3] : '',
    folder: parts.slice(0, -1).join('/'),
    trackNumber: Number(title.match(/^(\d{1,3})[\s._-]/)?.[1]) || 0,
    size: file.size,
    type: file.type,
    addedAt: new Date().toISOString(),
    analysis: null,
  };
}

export function listLibraryTracks() {
  // Metadata only; do not hydrate every album's audio into memory.
  return transaction('readonly', (tx, done) => {
    const request = tx.objectStore('tracks').getAll();
    request.onsuccess = () => done(request.result);
  });
}

export async function importLibraryTrack(file, path) {
  if (!isLibraryAudio(file)) return Promise.reject(new Error('Choose an audio file.'));
  const track = libraryMetadata(file, path);
  // Tag failure must never make otherwise playable audio impossible to import.
  try {
    Object.assign(track, await readLibraryTags(file));
  } catch {
    /* filename fallback */
  }
  const legacyFingerprint = track.fingerprint;
  // Lazily upgrade the previous path/size/date identity without changing IDs,
  // playlists, user tags or healthy bytes. Compare outside the IDB transaction.
  const legacy = await transaction('readonly', (tx, done) => {
    const lookup = tx.objectStore('tracks').index('fingerprint').get(legacyFingerprint);
    lookup.onsuccess = () => {
      if (!lookup.result) {
        done(null);
        return;
      }
      const audio = tx.objectStore('audio').get(lookup.result.id);
      audio.onsuccess = () => done({ track: lookup.result, blob: audio.result?.blob });
    };
  });
  track.fingerprint = await hashLibraryAudio(file);
  const reusable = legacy?.blob && (await hashLibraryAudio(legacy.blob)) === track.fingerprint;
  return transaction('readwrite', (tx, done) => {
    const tracks = tx.objectStore('tracks');
    const lookup = tracks.index('fingerprint').get(track.fingerprint);
    lookup.onsuccess = () => {
      if (lookup.result) {
        // Only a verified content identity may repair missing audio. Never
        // replace healthy bytes or user metadata when importing a duplicate.
        const audio = tx.objectStore('audio');
        const existing = audio.get(lookup.result.id);
        existing.onsuccess = () => {
          if (!existing.result?.blob) audio.put({ id: lookup.result.id, blob: file });
        };
        done({ track: lookup.result, duplicate: true });
        return;
      }
      const add = () => {
        tracks.put(track);
        tx.objectStore('audio').put({ id: track.id, blob: file });
        done({ track, duplicate: false });
      };
      if (reusable) {
        const current = tracks.get(legacy.track.id);
        current.onsuccess = () => {
          if (current.result?.fingerprint !== legacyFingerprint) {
            add();
            return;
          }
          const upgraded = { ...current.result, fingerprint: track.fingerprint };
          tracks.put(upgraded);
          done({ track: upgraded, duplicate: true });
        };
      } else add();
    };
  });
}

export function getLibraryAudio(id) {
  return transaction('readonly', (tx, done) => {
    const request = tx.objectStore('audio').get(id);
    request.onsuccess = () => done(request.result?.blob || null);
  });
}

export function saveLibraryAnalysis(id, analysis) {
  return transaction('readwrite', (tx, done) => {
    const tracks = tx.objectStore('tracks');
    const request = tracks.get(id);
    request.onsuccess = () => {
      if (!request.result) return;
      const track = { ...request.result, analysis };
      tracks.put(track);
      done(track);
    };
  });
}

export function updateLibraryTrack(id, changes) {
  return transaction('readwrite', (tx, done) => {
    const tracks = tx.objectStore('tracks');
    const request = tracks.get(id);
    request.onsuccess = () => {
      if (!request.result) return;
      const track = { ...request.result };
      for (const key of ['title', 'artist', 'album', 'albumArtist', 'genre']) {
        if (typeof changes[key] === 'string' && (key !== 'title' || changes[key].trim()))
          track[key] = changes[key].trim().slice(0, 200);
      }
      if ('favorite' in changes) track.favorite = changes.favorite === true;
      for (const key of ['trackNumber', 'discNumber', 'year'])
        if (Number.isSafeInteger(changes[key]) && changes[key] >= 0 && changes[key] <= 9999)
          track[key] = changes[key];
      if ('trashedAt' in changes) track.trashedAt = changes.trashedAt;
      if (changes.analysis) track.analysis = changes.analysis;
      tracks.put(track);
      done(track);
    };
  });
}

// Capture entries synchronously during drop; browsers clear DataTransfer later.
export function droppedLibraryFiles(dataTransfer) {
  const libraryId = dataTransfer.getData?.(LIBRARY_DRAG_TYPE);
  if (libraryId)
    return (async () => {
      const tracks = await listLibraryTracks();
      const track = tracks.find((item) => item.id === libraryId && !item.trashedAt);
      const blob = track && (await getLibraryAudio(track.id));
      if (!blob)
        throw new Error('Library audio is unavailable. Restore it from Trash or reimport it.');
      return [
        { file: new File([blob], track.name, { type: blob.type || track.type }), path: track.path },
      ];
    })();
  const entries = Array.from(dataTransfer.items || [])
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);
  const files = Array.from(dataTransfer.files || []);
  if (!entries.length)
    return Promise.resolve(
      files.map((file) => ({ file, path: file.webkitRelativePath || file.name }))
    );
  async function visit(entry, prefix = '') {
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      return [{ file, path: `${prefix}${entry.name}` }];
    }
    if (!entry.isDirectory) return [];
    const reader = entry.createReader();
    const result = [];
    // readEntries may return only the first 100 children on each call.
    for (;;) {
      const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) {
        for (const item of await visit(child, `${prefix}${entry.name}/`)) result.push(item);
      }
    }
    return result;
  }
  return (async () => {
    const result = [];
    for (const entry of entries) {
      for (const item of await visit(entry)) result.push(item);
    }
    return result;
  })();
}

export function selectLibraryTracks(tracks, { query = '', folder = '', sort = 'title' } = {}) {
  const needle = query.toLocaleLowerCase().trim();
  return tracks
    .filter(
      (track) =>
        (!folder || track.folder === folder) &&
        (!needle ||
          `${track.title} ${track.artist || ''} ${track.album} ${track.folder} ${track.analysis?.key || ''} ${track.analysis?.bpm || ''}`
            .toLocaleLowerCase()
            .includes(needle))
    )
    .sort((a, b) => {
      if (sort === 'recent') return String(b.addedAt || '').localeCompare(String(a.addedAt || ''));
      if (sort === 'artist')
        return (a.artist || '').localeCompare(b.artist || '') || a.title.localeCompare(b.title);
      if (sort === 'bpm')
        return (
          (a.analysis?.bpm ?? Infinity) - (b.analysis?.bpm ?? Infinity) ||
          a.title.localeCompare(b.title, undefined, { numeric: true })
        );
      if (sort === 'key')
        return (
          (a.analysis?.key || '\uffff').localeCompare(b.analysis?.key || '\uffff') ||
          a.title.localeCompare(b.title)
        );
      if (sort === 'album')
        return (
          a.folder.localeCompare(b.folder) ||
          a.trackNumber - b.trackNumber ||
          a.title.localeCompare(b.title, undefined, { numeric: true })
        );
      return a.title.localeCompare(b.title, undefined, { numeric: true });
    });
}
