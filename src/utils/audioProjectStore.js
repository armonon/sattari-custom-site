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

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Audio asset could not be encoded.'));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl) {
  const [header, encoded] = String(dataUrl).split(',', 2);
  if (!header?.startsWith('data:') || !encoded)
    throw new Error('Project contains a damaged audio asset.');
  const mime = header.slice(5).split(';')[0] || 'application/octet-stream';
  const bytes = atob(encoded);
  const output = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) output[index] = bytes.charCodeAt(index);
  return new Blob([output], { type: mime });
}

export async function exportAudioAssets(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const records = [];
  for (const id of uniqueIds) {
    const asset = await getAudioAsset(id);
    if (!asset?.blob) continue;
    records.push({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      size: asset.size,
      createdAt: asset.createdAt,
      analysis: asset.analysis,
      data: await blobToDataUrl(asset.blob),
    });
  }
  return records;
}

export async function importAudioAssets(records = []) {
  for (const record of records) {
    if (!record?.id || !record.data) continue;
    const blob = dataUrlToBlob(record.data);
    await putAudioAsset(blob, {
      id: record.id,
      name: record.name,
      type: record.type || blob.type,
      createdAt: record.createdAt,
      analysis: record.analysis || null,
    });
  }
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
