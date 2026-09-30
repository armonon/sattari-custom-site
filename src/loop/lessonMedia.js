export function wavBlob(notes, duration, sampleRate = 16000) {
  const samples = new Float32Array(Math.ceil(Math.min(480, duration) * sampleRate));
  for (const note of notes) {
    const frequency = 440 * 2 ** ((note.midi - 69) / 12);
    const begin = Math.max(0, Math.round(note.start * sampleRate));
    const end = Math.min(samples.length, Math.round(note.end * sampleRate));
    for (let i = begin; i < end; i++) {
      const t = (i - begin) / sampleRate;
      const release = Math.min(1, (end - i) / (sampleRate * 0.025));
      samples[i] +=
        Math.sin(2 * Math.PI * frequency * t) *
        Math.min(1, t * 150) *
        Math.exp(-t * 2) *
        release *
        0.2;
    }
  }
  return pcmWav(samples, sampleRate);
}
export function pcmWav(samples, rate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2),
    data = new DataView(buffer);
  const write = (offset, text) =>
    [...text].forEach((c, i) => data.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  data.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, rate, true);
  data.setUint32(28, rate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  write(36, 'data');
  data.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) =>
    data.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true)
  );
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function mediaStore(action, value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('loop-learning-media-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('media', action === 'list' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('media');
      const request =
        action === 'list'
          ? store.getAll()
          : action === 'delete'
            ? store.delete(value)
            : store.put(value);
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () =>
        reject(tx.error || new Error('Device storage is unavailable.'));
    });
  } finally {
    db.close();
  }
}

export async function mergeMedia(records) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('loop-learning-media-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const added = [],
        tx = db.transaction('media', 'readwrite'),
        store = tx.objectStore('media');
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
