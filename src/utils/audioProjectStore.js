const DATABASE_NAME = 'sattari-audio-workspace-v1';
const DATABASE_VERSION = 1;
const ASSET_STORE = 'audio-assets';
const SESSION_KEY = 'sattari-studio-session-v2';

function createId(prefix = 'asset') {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${prefix}-${randomId}`;
}

function openDatabase() {
  if (!globalThis.indexedDB)
    return Promise.reject(new Error('Local audio storage is unavailable.'));

  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_STORE)) {
        database.createObjectStore(ASSET_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Could not open local audio storage.'));
  });
}

async function runTransaction(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(ASSET_STORE, mode);
      const store = transaction.objectStore(ASSET_STORE);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Local audio storage failed.'));
    });
  } finally {
    database.close();
  }
}

export async function putAudioAsset(blob, metadata = {}) {
  const id = metadata.id || createId('audio');
  const record = {
    id,
    blob,
    name: metadata.name || blob.name || 'Audio asset',
    type: metadata.type || blob.type || 'audio/*',
    size: blob.size,
    createdAt: metadata.createdAt || new Date().toISOString(),
    analysis: metadata.analysis || null,
  };
  await runTransaction('readwrite', (store) => store.put(record));
  return { ...record, blob: undefined };
}

export async function getAudioAsset(id) {
  if (!id) return null;
  return (await runTransaction('readonly', (store) => store.get(id))) || null;
}

export async function deleteAudioAsset(id) {
  if (!id) return;
  await runTransaction('readwrite', (store) => store.delete(id));
}

export async function listAudioAssets() {
  return (await runTransaction('readonly', (store) => store.getAll())) || [];
}

export function saveStudioSession(session) {
  globalThis.localStorage?.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...session,
      schema: 'SattariStudio.session.v2',
      savedAt: new Date().toISOString(),
    })
  );
}

export function loadStudioSession() {
  try {
    const value = globalThis.localStorage?.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value);
    return session.schema === 'SattariStudio.session.v2' ? session : null;
  } catch {
    return null;
  }
}

export function clearStudioSession() {
  globalThis.localStorage?.removeItem(SESSION_KEY);
}

export { SESSION_KEY };
