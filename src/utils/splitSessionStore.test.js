import { afterEach, expect, it, vi } from 'vitest';
import {
  deleteSplitSession,
  hydrateSplitSession,
  loadSplitSessions,
  saveSplitSession,
} from './splitSessionStore';

afterEach(() => vi.unstubAllGlobals());

it('rehydrates stored blobs and turns interrupted work into a retryable session', () => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:recovered');
    }
  );
  const source = new File(['source'], 'mix.wav', { type: 'audio/wav' });
  const output = new Blob(['wav'], { type: 'audio/wav' });
  const recovered = hydrateSplitSession({
    id: 'one',
    file: source,
    status: 'processing',
    message: 'Reading audio',
    outputs: [{ id: 'bass', blob: output, name: 'mix-bass.wav' }],
  });
  expect(recovered).toMatchObject({
    file: source,
    status: 'cancelled',
    message: 'Interrupted. Retry when ready.',
    outputs: [{ id: 'bass', blob: output, url: 'blob:recovered' }],
  });
});

it('rejects malformed stored stems without creating object URLs', () => {
  const source = new File(['source'], 'mix.wav', { type: 'audio/wav' });
  expect(() =>
    hydrateSplitSession({
      id: 'bad',
      file: source,
      status: 'done',
      message: 'Ready',
      outputs: [{ id: 'unknown', blob: new Blob(['wav']), name: 'bad.wav' }],
    })
  ).toThrow('Saved stem data is invalid.');
});

it('rejects completed records with no outputs and invalid states', () => {
  const source = new File(['source'], 'mix.wav', { type: 'audio/wav' });
  expect(() =>
    hydrateSplitSession({
      id: 'empty',
      file: source,
      status: 'done',
      message: 'Ready',
      outputs: [],
    })
  ).toThrow('Completed session has no stem data.');
  expect(() =>
    hydrateSplitSession({ id: 'state', file: source, status: 'unknown', message: '', outputs: [] })
  ).toThrow('Saved session status is invalid.');
});

it('round-trips a session and serializes save-before-delete mutations', async () => {
  const records = new Map();
  const store = {
    put(record) {
      records.set(record.id, record);
      return { result: record.id };
    },
    delete(id) {
      records.delete(id);
      return { result: id };
    },
    getAll() {
      return { result: [...records.values()] };
    },
  };
  const db = {
    objectStoreNames: { contains: () => true },
    transaction() {
      const tx = { objectStore: () => store };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };
  vi.stubGlobal('indexedDB', {
    open() {
      const request = { result: db };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  });
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:round-trip');
      static revokeObjectURL = vi.fn();
    }
  );
  const file = new File(['source'], 'mix.wav', { type: 'audio/wav' });
  const blob = new Blob(['wav'], { type: 'audio/wav' });
  const job = {
    id: 'ordered',
    file,
    status: 'done',
    message: 'Ready',
    progress: 1,
    outputs: [{ id: 'bass', blob, name: 'mix-bass.wav', peaks: new Float32Array([0.2]) }],
  };
  const saving = saveSplitSession(job);
  const deleting = deleteSplitSession(job.id);
  await Promise.all([saving, deleting]);
  expect(records.has(job.id)).toBe(false);

  await saveSplitSession(job);
  const restored = await loadSplitSessions();
  expect(restored.sessions[0]).toMatchObject({
    file: expect.objectContaining({ name: 'mix.wav' }),
    status: 'done',
    outputs: [{ blob, name: 'mix-bass.wav', url: 'blob:round-trip' }],
  });
  expect(restored.warnings).toEqual([]);
  restored.sessions[0].outputs.forEach(({ url }) => URL.revokeObjectURL(url));
  await deleteSplitSession(job.id);
  expect((await loadSplitSessions()).sessions).toEqual([]);
});
