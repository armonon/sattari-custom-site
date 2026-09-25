import { validateArrangement } from './arrangementModel';

const DATABASE_NAME = 'sattari-audio-workspace-v1';
const DATABASE_VERSION = 1;
const ASSET_STORE = 'audio-assets';
const SESSION_KEY = 'sattari-studio-session-v2';
let observedStorage;
let observedSession;

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
      // A successful put is not durable until the transaction commits. Quota or
      // disk errors may abort it after request.onsuccess has already fired.
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onabort = () =>
        reject(transaction.error || new Error('Local audio storage was not saved.'));
      transaction.onerror = () =>
        reject(transaction.error || new Error('Local audio storage failed.'));
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
    if (!asset?.blob)
      throw new Error(
        `Project audio is missing (${id}). Reconnect it before creating a portable backup.`
      );
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
  if (!Array.isArray(records)) throw new Error('Project audio assets must be a list.');
  const idMap = new Map();
  // Validate everything before writing. New IDs isolate imports from existing
  // sets, even when another project reuses an embedded asset identifier.
  const prepared = records.map((record) => {
    if (
      typeof record?.id !== 'string' ||
      !record.id ||
      (!record.data && !(record.blob instanceof Blob)) ||
      idMap.has(record.id)
    )
      throw new Error('Project contains an invalid or duplicate audio asset.');
    const blob = record.blob instanceof Blob ? record.blob : dataUrlToBlob(record.data);
    const id = createId('audio');
    idMap.set(record.id, id);
    return {
      id,
      blob,
      size: blob.size,
      name: record.name,
      type: record.type || blob.type,
      createdAt: record.createdAt,
      analysis: record.analysis || null,
    };
  });
  if (prepared.length)
    await runTransaction('readwrite', (store) => {
      for (const record of prepared) store.put(record);
    });
  return idMap;
}

export function validateStudioProject(project) {
  const fail = () => {
    throw new Error('Project contains invalid settings. The current session was not replaced.');
  };
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const fields = (value, strings = [], numbers = []) => {
    if (!object(value)) fail();
    for (const key of strings) if (value[key] != null && typeof value[key] !== 'string') fail();
    for (const key of numbers) if (value[key] != null && !Number.isFinite(value[key])) fail();
  };
  fields(project, ['sessionName']);
  if (project.arranger != null) validateArrangement(project.arranger);
  if (!Array.isArray(project.decks) || project.decks.length > 4) fail();
  if (project.master != null)
    fields(
      project.master,
      ['projectKey', 'crossfaderCurve', 'aiMasterMode'],
      ['bpm', 'level', 'crossfader']
    );
  for (const deck of project.decks) {
    if (deck == null) continue;
    fields(
      deck,
      ['id', 'title', 'keyName', 'sourceKeyName', 'activeToolTab'],
      ['bpm', 'duration', 'gain', 'fader', 'pitch', 'filter', 'loopStart', 'loopEnd']
    );
    if (
      deck.waveform != null &&
      (!Array.isArray(deck.waveform) || !deck.waveform.every(Number.isFinite))
    )
      fail();
    for (const key of ['eq', 'fx'])
      if (deck[key] != null) {
        if (!object(deck[key]) || !Object.values(deck[key]).every(Number.isFinite)) fail();
      }
    if (
      deck.hotCues != null &&
      (!Array.isArray(deck.hotCues) ||
        deck.hotCues.length > 8 ||
        !deck.hotCues.every((cue) => cue == null || (Number.isFinite(cue) && cue >= 0)))
    )
      fail();
    if (deck.stemFx != null) {
      if (!object(deck.stemFx)) fail();
      for (const effects of Object.values(deck.stemFx))
        fields(effects, [], ['filter', 'send', 'pitch']);
    }
    if (deck.arrangement != null) {
      fields(
        deck.arrangement,
        ['automationTarget'],
        ['start', 'trimStart', 'trimEnd', 'gain', 'fadeIn', 'fadeOut']
      );
      const automation = deck.arrangement.automation;
      if (automation != null) {
        if (!object(automation)) fail();
        for (const points of Object.values(automation)) {
          if (!Array.isArray(points)) fail();
          for (const point of points) {
            fields(point, [], ['position', 'value']);
            if (!Number.isFinite(point.position) || !Number.isFinite(point.value)) fail();
          }
        }
      }
    }
    if (deck.lanes != null) {
      if (!object(deck.lanes)) fail();
      for (const lane of Object.values(deck.lanes))
        fields(lane, ['assetId', 'name', 'status'], ['level', 'pitch', 'duration']);
    }
  }
  for (const key of ['pads', 'recordings', 'pianoNotes'])
    if (project[key] != null && !Array.isArray(project[key])) fail();
  for (const pad of project.pads || [])
    fields(pad, ['assetId', 'name', 'accent'], ['gain', 'frequency']);
  for (const take of project.recordings || []) fields(take, ['id', 'name', 'createdAt'], ['size']);
  for (const note of project.pianoNotes || []) fields(note, ['pitch'], ['step', 'velocity']);
}

export function saveStudioSession(session) {
  if (!globalThis.localStorage) throw new Error('Local project storage is unavailable.');
  const storage = globalThis.localStorage;
  const existing = storage.getItem?.(SESSION_KEY);
  if (storage === observedStorage && existing !== observedSession)
    throw new Error(
      'Another Studio tab changed this session. Autosave is paused to protect both versions. Save a portable backup, then close older tabs and reopen the desired project.'
    );
  const value = JSON.stringify({
    ...session,
    schema: session.arranger ? 'SattariStudio.session.v3' : 'SattariStudio.session.v2',
    savedAt: new Date().toISOString(),
  });
  storage.setItem(SESSION_KEY, value);
  observedStorage = storage;
  observedSession = storage.getItem ? value : undefined;
}

export function loadStudioSession() {
  const value = globalThis.localStorage?.getItem(SESSION_KEY);
  observedStorage = globalThis.localStorage;
  observedSession = value;
  if (!value) return null;
  const session = JSON.parse(value);
  if (!['SattariStudio.session.v2', 'SattariStudio.session.v3'].includes(session?.schema))
    throw new Error('Saved project format is unsupported. The stored copy has been preserved.');
  validateStudioProject({
    ...session,
    decks: session.decks || [],
    master: { bpm: session.masterBpm, level: session.masterLevel },
  });
  return session;
}

export function clearStudioSession() {
  globalThis.localStorage?.removeItem(SESSION_KEY);
  observedStorage = globalThis.localStorage;
  observedSession = null;
}

export { SESSION_KEY };
