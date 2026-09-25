export const emptyOrganization = () => ({ playlists: [], queue: [] });
const id = () => crypto.randomUUID();

export function organizeLibrary(state, command) {
  const next = structuredClone(state);
  const playlist = next.playlists.find((item) => item.id === command.playlistId);
  if (command.type === 'create') {
    const name = command.name.trim().slice(0, 80);
    if (!name) throw new Error('Give your playlist a name.');
    next.playlists.push({ id: id(), name, tracks: [] });
  } else if (command.type === 'rename') {
    if (!playlist) throw new Error('This playlist is no longer available.');
    const name = command.name.trim().slice(0, 80);
    if (!name) throw new Error('Give your playlist a name.');
    playlist.name = name;
  } else if (command.type === 'delete') {
    next.playlists = next.playlists.filter((item) => item.id !== command.playlistId);
  } else if (command.type === 'merge') {
    for (const item of command.organization.playlists) {
      if (
        !next.playlists.some(
          (existing) =>
            existing.name === item.name &&
            JSON.stringify(existing.tracks) === JSON.stringify(item.tracks)
        )
      )
        next.playlists.push({ ...item, id: id() });
    }
    for (const item of command.organization.queue) {
      if (!next.queue.some((existing) => existing.id === item.id)) next.queue.push(item);
    }
  } else if (command.type === 'addMany' || command.type === 'enqueueMany') {
    if (
      !Array.isArray(command.trackIds) ||
      command.trackIds.length > 10000 ||
      command.trackIds.some((track) => typeof track !== 'string')
    )
      throw new Error('Invalid song selection.');
    if (command.type === 'addMany' && !playlist) throw new Error('Choose a playlist first.');
    for (const trackId of new Set(command.trackIds)) {
      if (command.type === 'enqueueMany') next.queue.push({ id: id(), trackId });
      else if (!playlist.tracks.includes(trackId)) playlist.tracks.push(trackId);
    }
  } else if (command.type === 'reorder') {
    if (!playlist) throw new Error('Choose a playlist first.');
    const from = playlist.tracks.indexOf(command.trackId),
      to = playlist.tracks.indexOf(command.beforeId);
    if (from >= 0 && to >= 0 && from !== to) {
      playlist.tracks.splice(from, 1);
      playlist.tracks.splice(playlist.tracks.indexOf(command.beforeId), 0, command.trackId);
    }
  } else if (command.type === 'add') {
    if (!playlist) throw new Error('Choose a playlist first.');
    if (!playlist.tracks.includes(command.trackId)) playlist.tracks.push(command.trackId);
  } else if (command.type === 'remove') {
    if (playlist) playlist.tracks = playlist.tracks.filter((track) => track !== command.trackId);
  } else if (command.type === 'enqueue') {
    next.queue.push({ id: id(), trackId: command.trackId });
  } else if (command.type === 'dequeue') {
    next.queue = next.queue.filter((item) => item.id !== command.id);
  } else if (command.type === 'move') {
    const list = command.playlistId ? playlist?.tracks : next.queue;
    if (!list) throw new Error('This playlist is no longer available.');
    const index = list.findIndex((item) =>
      command.playlistId ? item === command.trackId : item.id === command.id
    );
    const to = index + command.direction;
    if (index >= 0 && to >= 0 && to < list.length)
      [list[index], list[to]] = [list[to], list[index]];
  }
  return next;
}

// Independent of projects, just like the existing device-local audio library.
// Read/modify/write in one IDB transaction avoids cross-tab lost updates.
export function libraryOrganization(command = null) {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Library organization storage is unavailable.'));
      return;
    }
    let blocked = false;
    const request = indexedDB.open('sattari-library-organization-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('organization');
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error('Close other Studio tabs, then reopen Library to use playlists and the queue.')
      );
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      const tx = db.transaction('organization', command ? 'readwrite' : 'readonly');
      const store = tx.objectStore('organization');
      let result, failure;
      const read = store.get('collection');
      read.onsuccess = () => {
        try {
          result = read.result || emptyOrganization();
          if (command) {
            result = organizeLibrary(result, command);
            store.put(result, 'collection');
          }
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(failure || tx.error || new Error('Could not save library organization.'));
      };
    };
  });
}
