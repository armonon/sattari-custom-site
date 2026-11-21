// Browser saving for Key & BPM rows (IndexedDB), so a reload does not lose
// measurements or corrections. Audio files are kept only within a budget;
// beyond it a row is saved without its audio and restores like a report row.
// Records are revalidated with the report schema before they are shown.
import { parseKeyBpmReport } from './keyBpmReport';

const DB_NAME = 'sattari-keybpm';
const STORE = 'rows';
export const KEYBPM_AUDIO_BUDGET = 600 * 1024 ** 2;
const MAX_ROWS = 200;

let databasePromise;
let writes = Promise.resolve();

function open() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('Browser storage is unavailable.'));
  databasePromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open browser storage.'));
    request.onblocked = () => reject(new Error('Browser storage is busy in another tab.'));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

function transact(mode, operation) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = operation(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request?.result);
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('Browser storage failed.'));
      })
  );
}

const queue = (operation) => {
  writes = writes.catch(() => {}).then(operation);
  return writes;
};

const meta = (file) => ({
  name: file.name,
  size: file.size,
  type: file.type || '',
  lastModified: file.lastModified || 0,
});

/** Serializable record. keepAudio decides whether the Blob is stored. */
export function rowRecord(row, order, keepAudio) {
  const audio = keepAudio && row.file instanceof Blob && !row.fromReport;
  return {
    id: row.id,
    order,
    file: audio ? row.file : meta(row.file),
    hasAudio: audio,
    // Work in progress restores as waiting, so Resume can run it again.
    status: row.status === 'analyzing' ? 'queued' : row.status,
    result: row.result || null,
    measuredAt: row.measuredAt || null,
    ...(row.user ? { user: row.user } : {}),
    ...(row.origin ? { origin: row.origin } : {}),
    fromReport: Boolean(row.fromReport),
    savedAt: Date.now(),
  };
}

/** Which rows may keep their audio: in list order, until the budget is spent. */
export function audioAllowance(rows, budget = KEYBPM_AUDIO_BUDGET) {
  const keep = new Set();
  let used = 0;
  for (const row of rows) {
    if (!(row.file instanceof Blob) || row.fromReport) continue;
    if (used + row.file.size > budget) continue;
    used += row.file.size;
    keep.add(row.id);
  }
  return keep;
}

export function saveKeyBpmRows(records) {
  return queue(() =>
    transact('readwrite', (store) => {
      for (const record of records) store.put(record);
      return null;
    })
  );
}

export function deleteKeyBpmRows(ids) {
  return queue(() =>
    transact('readwrite', (store) => {
      for (const id of ids) store.delete(id);
      return null;
    })
  );
}

export function clearKeyBpmRows() {
  return queue(() => transact('readwrite', (store) => store.clear()));
}

/** Validate one saved record; throws on anything the report schema rejects. */
export function hydrateRow(record) {
  if (!record || typeof record.id !== 'string' || !record.id) throw new Error('Invalid row.');
  const file = record.file;
  if (!file || typeof file.name !== 'string' || !file.name) throw new Error('Invalid source.');
  if (record.hasAudio && !(file instanceof Blob)) throw new Error('Saved audio is missing.');
  const base = {
    id: record.id,
    file,
    status: record.status,
    ...(record.fromReport ? { fromReport: true } : {}),
    ...(!record.hasAudio && !record.fromReport ? { audioNotSaved: true } : {}),
  };
  if (record.status === 'queued') {
    if (!record.hasAudio) throw new Error('A waiting row needs its audio.');
    return { ...base, result: null, ...(record.origin ? { origin: record.origin } : {}) };
  }
  if (!['done', 'error'].includes(record.status)) throw new Error('Invalid row status.');
  const report = parseKeyBpmReport(
    JSON.stringify({
      schema: 'SattariKeyBpm.report',
      version: 2,
      createdAt: new Date().toISOString(),
      tracks: [
        {
          source: meta(file),
          measuredAt: record.measuredAt,
          result: record.result,
          ...(record.user ? { user: record.user } : {}),
          ...(record.origin ? { origin: record.origin } : {}),
        },
      ],
    })
  );
  const [track] = report.tracks;
  return {
    ...base,
    result: track.result,
    measuredAt: track.measuredAt,
    ...(track.user ? { user: track.user } : {}),
    ...(track.origin ? { origin: { ...record.origin, ...track.origin } } : {}),
  };
}

export function loadKeyBpmRows() {
  return transact('readonly', (store) => store.getAll()).then((records) => {
    const rows = [];
    let skipped = 0;
    for (const record of [...(records || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      if (rows.length >= MAX_ROWS) {
        skipped++;
        continue;
      }
      try {
        rows.push(hydrateRow(record));
      } catch {
        skipped++;
      }
    }
    return { rows, skipped };
  });
}
