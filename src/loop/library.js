const DB_NAME = 'loop-guitar-practice-v1';

function openLibrary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('songs', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, work) {
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('songs', mode);
      let result;
      const request = work(tx.objectStore('songs'));
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Library save was interrupted.'));
    });
  } finally {
    db.close();
  }
}

export async function readLibrary() {
  const songs = await transaction('readonly', (store) => store.getAll());
  return songs
    .filter(
      (s) =>
        s.file instanceof Blob &&
        s.lesson &&
        Array.isArray(s.lesson.notes) &&
        Array.isArray(s.lesson.chords)
    )
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function saveSong(record) {
  return transaction('readwrite', (store) => store.put({ ...record, savedAt: Date.now() }));
}

export function removeSong(id) {
  return transaction('readwrite', (store) => store.delete(id));
}

export async function mergeSongs(records) {
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const added = [],
        tx = db.transaction('songs', 'readwrite'),
        store = tx.objectStore('songs');
      for (const record of records) {
        const request = store.get(record.id);
        request.onsuccess = () => {
          if (!request.result) {
            store.add(record);
            added.push(record.id);
          }
        };
      }
      tx.oncomplete = () => resolve(added);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Restore interrupted.'));
    });
  } finally {
    db.close();
  }
}
