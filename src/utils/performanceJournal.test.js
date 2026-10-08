import { it, expect, vi, afterEach } from 'vitest';
import { PerformanceJournal } from './performanceJournal';
afterEach(() => vi.useRealTimers());
const backend = () => {
  const events = new Map(),
    takes = new Map();
  return {
    events,
    takes,
    commit: vi.fn(async (take, rows) => {
      takes.set(take.id, structuredClone(take));
      for (const row of rows) events.set(`${row.takeId}:${row.sequence}`, structuredClone(row));
    }),
  };
};
it('commits incremental batches and preserves crash recovery without calling finish', async () => {
  vi.useFakeTimers();
  let time = 0;
  const store = backend(),
    journal = new PerformanceJournal({ store, clock: () => time });
  await journal.start({ timelineStart: 12 });
  for (let n = 0; n < 1000; n++)
    journal.append({ type: 'setDeckGain', time: n / 100, args: ['A', n % 100] });
  time = 10;
  await vi.advanceTimersByTimeAsync(250);
  journal.append({ type: 'setDeckFx', time: 10.1, args: ['A', { echo: 40 }] });
  time = 10.2;
  await journal.flush();
  journal.dispose();
  expect(store.events.size).toBe(1001);
  expect(store.commit.mock.calls.at(-1)[1]).toHaveLength(1);
  expect(store.takes.get(journal.take.id)).toMatchObject({
    duration: 10.2,
    timelineStart: 12,
    state: 'recording',
  });
});
it('retries failed transactions without duplicating or losing pending events', async () => {
  vi.useFakeTimers();
  const store = backend(),
    journal = new PerformanceJournal({ store });
  await journal.start();
  journal.append({ time: 0, type: 'initialState', args: [{}] });
  store.commit.mockRejectedValueOnce(new Error('disk full'));
  await expect(journal.flush()).rejects.toThrow('disk full');
  expect(journal.pending).toHaveLength(1);
  await journal.finish({ duration: 5 });
  expect(store.events.size).toBe(1);
  expect(journal.pending).toHaveLength(0);
  expect(store.takes.get(journal.take.id).state).toBe('stopped');
});
it('does not lose events appended while a transaction is in flight', async () => {
  vi.useFakeTimers();
  const store = backend(),
    journal = new PerformanceJournal({ store });
  await journal.start();
  let release;
  store.commit.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  journal.append({ time: 0, type: 'a', args: [] });
  const first = journal.flush();
  journal.append({ time: 1, type: 'b', args: [] });
  release();
  await first;
  expect(journal.pending.map((row) => row.event.type)).toEqual(['b']);
  await journal.finish();
});
it('skips timer flushes while storage is busy instead of growing a promise backlog', async () => {
  vi.useFakeTimers();
  const store = backend(),
    journal = new PerformanceJournal({ store });
  await journal.start();
  let release;
  store.commit.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  journal.append({ time: 0, type: 'setMasterLevel', args: [100] });
  const pending = journal.flush();
  await vi.advanceTimersByTimeAsync(10000);
  expect(store.commit).toHaveBeenCalledTimes(2);
  release();
  await pending;
  await journal.finish();
});

it('reports a blank browser quota exception and retains pending events for retry', async () => {
  vi.useFakeTimers();
  const store = backend(),
    onError = vi.fn(),
    journal = new PerformanceJournal({ store, onError });
  await journal.start();
  journal.append({ time: 0, type: 'initialState', args: [{}] });
  store.commit.mockRejectedValueOnce(new DOMException('', 'QuotaExceededError'));
  await expect(journal.flush()).rejects.toMatchObject({ name: 'QuotaExceededError' });
  expect(journal.error).toMatch(/storage|quota/i);
  expect(onError).toHaveBeenCalledWith(journal.error);
  expect(journal.pending).toHaveLength(1);
  await journal.finish();
  expect(store.events.size).toBe(1);
  expect(journal.error).toBeNull();
});
