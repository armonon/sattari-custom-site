import { it, expect, vi } from 'vitest';
import { deferredSessionSave } from './deferredSessionSave';
it('serializes asynchronous writes and flushes the newest pending revision', async () => {
  let finish;
  const write = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValue(undefined);
  const report = vi.fn(),
    saver = deferredSessionSave(write, report);
  saver.schedule({ revision: 1 });
  const first = saver.flush();
  saver.schedule({ revision: 2 });
  const second = saver.flush();
  expect(write).toHaveBeenCalledTimes(1);
  finish();
  await Promise.all([first, second]);
  expect(write.mock.calls.map(([item]) => item.revision)).toEqual([1, 2]);
  expect(report).not.toHaveBeenCalled();
});
it('coalesces rapid edits, flushes latest on close, and reports conflicts', () => {
  vi.useFakeTimers();
  try {
    const write = vi.fn(),
      report = vi.fn(),
      saver = deferredSessionSave(write, report);
    for (let i = 0; i < 200; i++) saver.schedule({ revision: i });
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(write).toHaveBeenCalledExactlyOnceWith({ revision: 199 });
    saver.schedule({ revision: 200 });
    saver.flush();
    expect(write).toHaveBeenLastCalledWith({ revision: 200 });
    write.mockImplementation(() => {
      throw new Error('Another Studio tab');
    });
    saver.schedule({ revision: 201 });
    saver.flush();
    expect(report).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
