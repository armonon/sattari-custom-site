const DB_NAME = 'sattari-split-sessions';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;
const MAX_SESSIONS = 20;
const MAX_INPUT_BYTES = 300 * 1024 ** 2;
const MAX_OUTPUT_BYTES = 512 * 1024 ** 2;
const VALID_STEMS = new Set(['vocals', 'drums', 'bass', 'other']);
const VALID_STATUSES = new Set(['queued', 'processing', 'done', 'error', 'cancelled']);

function validPeaks(peaks) {
  return (
    peaks === undefined ||
    peaks === null ||
    ((Array.isArray(peaks) || peaks instanceof Float32Array) &&
      peaks.length <= 8192 &&
      peaks.every(Number.isFinite))
  );
}

function validAnalysis(analysis) {
  return (
    analysis === undefined ||
    analysis === null ||
    (typeof analysis === 'object' &&
      (analysis.key === undefined || analysis.key === null || typeof analysis.key === 'string') &&
      (analysis.bpm === undefined ||
        analysis.bpm === null ||
        (Number.isFinite(analysis.bpm) && analysis.bpm > 0)))
  );
}

let databasePromise;
let writes = Promise.resolve();

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('Browser storage is unavailable.'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME))
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
        const store = tx.objectStore(STORE_NAME);
        let result;
        try {
          result = operation(store);
        } catch (error) {
          reject(error);
          return;
        }
        tx.oncomplete = () => resolve(result?.result);
        tx.onerror = tx.onabort = () =>
          reject(tx.error || result?.error || new Error('Browser storage failed.'));
      })
  );
}

// Serialize mutations so a slower earlier snapshot cannot overwrite a newer one.
function enqueueWrite(operation) {
  writes = writes.catch(() => {}).then(operation);
  return writes;
}

export function saveSplitSession(job) {
  const record = {
    id: job.id,
    file: job.file,
    status: job.status,
    message: job.message,
    progress: job.progress,
    duration: job.duration,
    peaks: job.peaks,
    analysis: job.analysis,
    stems: job.stems,
    outputs: (job.outputs || []).map(({ id, blob, name, peaks, analysis }) => ({
      id,
      blob,
      name,
      peaks,
      analysis,
    })),
    updatedAt: Date.now(),
  };
  return enqueueWrite(() => transact('readwrite', (store) => store.put(record)));
}

export function deleteSplitSession(id) {
  return enqueueWrite(() => transact('readwrite', (store) => store.delete(id)));
}

export function loadSplitSessions() {
  return transact('readonly', (store) => store.getAll()).then((records) => {
    const sessions = [];
    const warnings = [];
    let inputBytes = 0;
    let outputBytes = 0;
    const newestFirst = [...(records || [])].sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );
    for (const record of newestFirst) {
      let session;
      try {
        session = hydrateSplitSession(record);
        const sessionOutputs = session.outputs.reduce((sum, output) => sum + output.blob.size, 0);
        if (
          sessions.length >= MAX_SESSIONS ||
          inputBytes + session.file.size > MAX_INPUT_BYTES ||
          outputBytes + sessionOutputs > MAX_OUTPUT_BYTES
        )
          throw new Error('Session exceeds aggregate browser recovery limits.');
        sessions.push(session);
        inputBytes += session.file.size;
        outputBytes += sessionOutputs;
      } catch (error) {
        session?.outputs.forEach(({ url }) => URL.revokeObjectURL(url));
        warnings.push(error instanceof Error ? error.message : 'A saved session is invalid.');
      }
    }
    return { sessions: sessions.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0)), warnings };
  });
}

export function hydrateSplitSession(record) {
  if (
    !record ||
    typeof record.id !== 'string' ||
    !record.id ||
    !(record.file instanceof Blob) ||
    typeof record.file.name !== 'string'
  )
    throw new Error('Saved session is missing a valid source file.');
  if (!VALID_STATUSES.has(record.status)) throw new Error('Saved session status is invalid.');
  if (
    typeof record.message !== 'string' ||
    (record.duration !== undefined &&
      (!Number.isFinite(record.duration) || record.duration < 0 || record.duration > 600)) ||
    (record.progress !== undefined &&
      record.progress !== null &&
      (!Number.isFinite(record.progress) || record.progress < 0 || record.progress > 1)) ||
    !validPeaks(record.peaks) ||
    !validAnalysis(record.analysis)
  )
    throw new Error('Saved session metadata is invalid.');
  if (record.file.size <= 0 || record.file.size > 100 * 1024 ** 2)
    throw new Error('Saved source exceeds the per-track limit.');
  if (!Array.isArray(record.outputs) || record.outputs.length > VALID_STEMS.size)
    throw new Error('Saved stems are invalid.');
  const seen = new Set();
  for (const output of record.outputs) {
    if (
      !output ||
      !VALID_STEMS.has(output.id) ||
      seen.has(output.id) ||
      !(output.blob instanceof Blob) ||
      typeof output.name !== 'string'
    )
      throw new Error('Saved stem data is invalid.');
    if (!validPeaks(output.peaks) || !validAnalysis(output.analysis))
      throw new Error('Saved stem measurements are invalid.');
    seen.add(output.id);
  }
  if (record.status === 'done' && !record.outputs.length)
    throw new Error('Completed session has no stem data.');
  if (record.outputs.reduce((sum, output) => sum + output.blob.size, 0) > MAX_OUTPUT_BYTES)
    throw new Error('Saved stems exceed browser recovery limits.');
  return {
    ...record,
    // A tab may have closed during inference; retain the source so the user can retry.
    status: record.status === 'processing' ? 'cancelled' : record.status,
    message: record.status === 'processing' ? 'Interrupted. Retry when ready.' : record.message,
    outputs: (record.outputs || []).map((output) => ({
      ...output,
      url: URL.createObjectURL(output.blob),
    })),
  };
}
