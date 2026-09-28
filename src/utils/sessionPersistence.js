// Track/take-level structured-clone persistence: large event histories are not
// JSON-stringified again when an unrelated fader moves. A revision check and
// all changed parts commit in the same transaction to reject cross-tab writes.
export function persistentSession({
  loadLegacy,
  saveLegacy,
  clearLegacy,
  databaseName = 'sattari-project-session-v4',
}) {
  let revision = null;
  let savedParts = new Map();
  const open = () =>
    new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('head');
        request.result.createObjectStore('parts');
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Close older Studio tabs to update project storage.'));
      };
      request.onsuccess = () => {
        if (blocked) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  const split = (session) => {
    const parts = new Map();
    const arranger = session.arranger;
    if (arranger) {
      arranger.tracks.forEach((track) => parts.set(`track:${track.id}`, track));
      (arranger.captures || []).forEach((take, i) => parts.set(`take:${i}`, take));
    }
    return {
      parts,
      session: {
        ...session,
        ...(arranger
          ? {
              arranger: {
                ...arranger,
                tracks: arranger.tracks.map((track) => `track:${track.id}`),
                captures: (arranger.captures || []).map((_, i) => `take:${i}`),
              },
            }
          : {}),
      },
    };
  };
  return {
    async load() {
      if (!globalThis.indexedDB) return loadLegacy();
      const db = await open();
      try {
        const value = await new Promise((resolve, reject) => {
          const tx = db.transaction(['head', 'parts'], 'readonly');
          const head = tx.objectStore('head').get('current');
          const parts = tx.objectStore('parts').getAll();
          const keys = tx.objectStore('parts').getAllKeys();
          tx.oncomplete = () =>
            resolve({
              head: head.result,
              parts: new Map(keys.result.map((key, i) => [key, parts.result[i]])),
            });
          tx.onabort = tx.onerror = () => reject(tx.error);
        });
        revision = value.head?.revision ?? null;
        if (!value.head) return loadLegacy();
        savedParts = value.parts;
        const session = value.head.session;
        if (!session) return null; // Persisted reset; don't resurrect a legacy save.
        // A missing part becomes a named stub: restore sets it aside (see
        // repairArrangement) instead of refusing to open the whole project.
        if (session.arranger)
          for (const field of ['tracks', 'captures'])
            session.arranger[field] = session.arranger[field].map((key) =>
              savedParts.has(key)
                ? savedParts.get(key)
                : { name: 'Missing saved part', missingPart: key }
            );
        return session;
      } finally {
        db.close();
      }
    },
    async save(session) {
      if (!globalThis.indexedDB) return saveLegacy(session);
      const db = await open(),
        next = split(session),
        nextRevision = crypto.randomUUID();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(['head', 'parts'], 'readwrite');
          let error;
          const head = tx.objectStore('head'),
            store = tx.objectStore('parts');
          const request = head.get('current');
          request.onsuccess = () => {
            if ((request.result?.revision ?? null) !== revision) {
              error = new Error(
                'Another Studio tab changed this session. Autosave is paused. Save a portable backup before reopening.'
              );
              tx.abort();
              return;
            }
            for (const [key, part] of next.parts)
              if (savedParts.get(key) !== part) store.put(part, key);
            for (const key of savedParts.keys()) if (!next.parts.has(key)) store.delete(key);
            head.put({ revision: nextRevision, session: next.session }, 'current');
          };
          tx.oncomplete = resolve;
          tx.onabort = tx.onerror = () => reject(error || tx.error);
        });
        revision = nextRevision;
        savedParts = next.parts;
      } finally {
        db.close();
      }
    },
    async clear() {
      // Save an empty project through the same concurrency guard. The UI will
      // replace it with its fresh workspace on the next normal autosave.
      if (!globalThis.indexedDB) return clearLegacy();
      await this.save({ decks: [], arranger: { version: 1, tracks: [], captures: [] } });
      clearLegacy();
    },
  };
}
