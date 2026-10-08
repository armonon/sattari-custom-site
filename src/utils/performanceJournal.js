// Append-only IndexedDB transactions: committed batches survive reload/crash.
// Only pending events are serialized, never the entire growing performance.
const DB = 'stemdeck-performance-journal-v1';
async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('takes')) db.createObjectStore('takes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('events')) {
        const events = db.createObjectStore('events', { keyPath: ['takeId', 'sequence'] });
        events.createIndex('take', 'takeId');
      }
      if (!db.objectStoreNames.contains('source-clips'))
        db.createObjectStore('source-clips', { keyPath: ['captureId', 'trackId', 'clipId'] });
      if (!db.objectStoreNames.contains('source-takes'))
        db.createObjectStore('source-takes', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export const journalStore = {
  async removeTestTake(takeId, sourceCaptureId) {
    // Explicit IDs only; used by generated-signal QA to clean its own fixtures.
    const db = await database();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['takes', 'events', 'source-takes', 'source-clips'], 'readwrite');
        if (takeId) tx.objectStore('takes').delete(takeId);
        if (sourceCaptureId) tx.objectStore('source-takes').delete(sourceCaptureId);
        for (const [store, key, value] of [
          ['events', 'takeId', takeId],
          ['source-clips', 'captureId', sourceCaptureId],
        ]) {
          if (!value) continue;
          const request = tx.objectStore(store).openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              if (cursor.value[key] === value) cursor.delete();
              cursor.continue();
            }
          };
        }
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
  async sourceClip(take, track, clip) {
    const db = await database();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['source-clips', 'source-takes'], 'readwrite');
        tx.objectStore('source-takes').put({
          id: take.id,
          name: take.name,
          // Preserve intentionally silent replay inputs without writing silent WAVs.
          tracks: (take.tracks || []).filter((t) => t.keepEmpty).map((t) => ({ ...t, clips: [] })),
        });
        tx.objectStore('source-clips').put({
          captureId: take.id,
          trackId: track.id,
          clipId: clip.id,
          track: { ...track, clips: [] },
          clip,
        });
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
  // What recovery still holds: take and source-capture ids, the audio they
  // reference, and how many events each take stores. Reads no event payloads.
  async inventory() {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(['takes', 'events', 'source-takes', 'source-clips'], 'readonly');
        const takes = tx.objectStore('takes').getAll(),
          sourceTakes = tx.objectStore('source-takes').getAllKeys(),
          clips = tx.objectStore('source-clips').getAll(),
          eventKeys = tx.objectStore('events').getAllKeys();
        tx.oncomplete = () => {
          const eventCounts = new Map();
          for (const [takeId] of eventKeys.result)
            eventCounts.set(takeId, (eventCounts.get(takeId) || 0) + 1);
          const captureAssets = new Map(sourceTakes.result.map((id) => [id, []]));
          for (const row of clips.result) {
            if (!captureAssets.has(row.captureId)) captureAssets.set(row.captureId, []);
            if (row.clip?.assetId) captureAssets.get(row.captureId).push(row.clip.assetId);
          }
          resolve({
            takes: takes.result.map((take) => ({
              id: take.id,
              assetId: take.assetId || '',
              sourceCaptureId: take.sourceCaptureId || '',
              events: eventCounts.get(take.id) || 0,
            })),
            captures: [...captureAssets].map(([id, assetIds]) => ({ id, assetIds })),
          });
        };
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
  // Removes recovery copies of takes that are already saved in the project.
  async discard({ takeIds = [], captureIds = [] }) {
    const takes = new Set(takeIds.filter(Boolean)),
      captures = new Set(captureIds.filter(Boolean));
    if (!takes.size && !captures.size) return;
    const db = await database();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['takes', 'events', 'source-takes', 'source-clips'], 'readwrite');
        // [id] sorts before every [id, \u2026] key, and [id, []] after all of them
        // (arrays sort above every other key type).
        for (const id of takes) {
          tx.objectStore('takes').delete(id);
          tx.objectStore('events').delete(IDBKeyRange.bound([id], [id, []]));
        }
        for (const id of captures) {
          tx.objectStore('source-takes').delete(id);
          tx.objectStore('source-clips').delete(IDBKeyRange.bound([id], [id, []]));
        }
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
  async recoverSources() {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(['source-clips', 'source-takes'], 'readonly');
        const takes = tx.objectStore('source-takes').getAll(),
          clips = tx.objectStore('source-clips').getAll();
        tx.oncomplete = () =>
          resolve(
            takes.result.map((take) => {
              const tracks = new Map(
                (take.tracks || []).map((track) => [track.id, { ...track, clips: [] }])
              );
              for (const row of clips.result)
                if (row.captureId === take.id) {
                  if (!tracks.has(row.trackId))
                    tracks.set(row.trackId, { ...row.track, clips: [] });
                  tracks.get(row.trackId).clips.push(row.clip);
                }
              return {
                ...take,
                tracks: [...tracks.values()].map((track) => ({
                  ...track,
                  clips: track.clips.sort((a, b) => a.start - b.start),
                })),
              };
            })
          );
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
  async commit(take, events) {
    const db = await database();
    try {
      await new Promise((resolve, reject) => {
        let tx;
        try {
          tx = db.transaction(['takes', 'events'], 'readwrite', { durability: 'strict' });
        } catch {
          tx = db.transaction(['takes', 'events'], 'readwrite');
        }
        tx.objectStore('takes').put(take);
        for (const event of events) tx.objectStore('events').put(event);
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () =>
          reject(tx.error || new Error('Journal transaction failed.'));
      });
    } finally {
      db.close();
    }
  },
  async recover() {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(['takes', 'events'], 'readonly');
        const takes = tx.objectStore('takes').getAll(),
          rows = tx.objectStore('events').getAll();
        tx.oncomplete = () =>
          resolve(
            takes.result.map((take) => ({
              ...take,
              events: rows.result
                .filter((row) => row.takeId === take.id)
                .sort((a, b) => a.sequence - b.sequence)
                .map((row) => row.event),
            }))
          );
        tx.onabort = tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
};

export class PerformanceJournal {
  constructor({ store = journalStore, clock = () => 0, interval = 250, onError = () => {} } = {}) {
    Object.assign(this, { store, clock, interval, onError });
    this.pending = [];
    this.sequence = 0;
    this.error = null;
  }
  async start(metadata = {}) {
    this.take = {
      ...metadata,
      id: crypto.randomUUID(),
      version: 3,
      assetId: '',
      name: metadata.name || `Performance ${new Date().toLocaleString()}`,
      startedAt: Date.now(),
      duration: 0,
      timelineStart: metadata.timelineStart || 0,
      state: 'recording',
      committedEvents: 0,
    };
    await this.store.commit(this.take, []);
    this.timer = setInterval(() => {
      if (!this.inflight) void this.flush().catch(() => {});
    }, this.interval);
    this.onHide = () => {
      void this.flush().catch(() => {});
    };
    globalThis.addEventListener?.('pagehide', this.onHide);
    return this.take.id;
  }
  append(event) {
    if (!this.take || this.closed) return;
    if (this.pending.length >= 8192) {
      this.fail(
        new Error(
          'Event journal cannot keep up. Stop and save this take; the printed recording is still running.'
        )
      );
      return;
    }
    this.pending.push({
      takeId: this.take.id,
      sequence: this.sequence++,
      event: structuredClone(event),
    });
  }
  fail(error) {
    this.error =
      error?.message ||
      'Event journal storage is full or unavailable. Pending events remain in memory; stop and save a portable backup.';
    this.onError(this.error);
  }
  async flush() {
    if (!this.take) return;
    if (this.inflight) {
      await this.inflight;
      return this.flush();
    }
    const rows = this.pending.slice();
    const take = {
      ...this.take,
      duration: Math.max(this.take.duration, this.clock()),
      committedEvents: this.take.committedEvents + rows.length,
      updatedAt: Date.now(),
    };
    this.inflight = this.store
      .commit(take, rows)
      .then(() => {
        this.pending.splice(0, rows.length);
        this.take = { ...this.take, ...take };
        this.error = null;
      })
      .catch((error) => {
        this.fail(error);
        throw error;
      });
    try {
      await this.inflight;
    } finally {
      this.inflight = null;
    }
  }
  async finish(metadata = {}) {
    this.dispose();
    if (this.inflight) await this.inflight.catch(() => {});
    Object.assign(this.take, metadata, { state: 'stopped' });
    await this.flush();
    this.closed = true;
  }
  async attach(metadata) {
    if (this.inflight) await this.inflight.catch(() => {});
    Object.assign(this.take, metadata);
    await this.flush();
  }
  dispose() {
    clearInterval(this.timer);
    globalThis.removeEventListener?.('pagehide', this.onHide);
  }
}
