// Per-song practice setup, in its own small IndexedDB database so that saving
// a fader move never rewrites the song's audio. Records are tiny JSON objects
// keyed by the song's id; they hold no audio and never leave the browser.
const DB_NAME = 'sattari-practice-state';
const STORE_NAME = 'practice';
const MAX_RECORDS = 60;

let databasePromise;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('Browser storage is unavailable.'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME))
          request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open browser storage.'));
      request.onblocked = () => reject(new Error('Browser storage is busy in another tab.'));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function transact(mode, operation) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        let result;
        try {
          result = operation(tx.objectStore(STORE_NAME));
        } catch (error) {
          reject(error);
          return;
        }
        tx.oncomplete = () => resolve(result?.result);
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('Browser storage failed.'));
      })
  );
}

/** Map of song id → raw stored state (validate with cleanPracticeState before use). */
export async function loadPracticeStates() {
  const records = (await transact('readonly', (store) => store.getAll())) || [];
  // Keep the store bounded: drop the oldest records beyond the cap.
  const sorted = [...records].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const stale = sorted.slice(MAX_RECORDS).filter((record) => typeof record?.id === 'string');
  if (stale.length)
    transact('readwrite', (store) => stale.forEach((record) => store.delete(record.id))).catch(
      () => {}
    );
  return new Map(
    sorted
      .slice(0, MAX_RECORDS)
      .filter((record) => typeof record?.id === 'string' && record.state)
      .map((record) => [record.id, record.state])
  );
}

export function savePracticeState(id, state) {
  return transact('readwrite', (store) => store.put({ id, state, updatedAt: Date.now() }));
}

export function deletePracticeState(id) {
  return transact('readwrite', (store) => store.delete(id));
}

export function clearPracticeStates() {
  return transact('readwrite', (store) => store.clear());
}
