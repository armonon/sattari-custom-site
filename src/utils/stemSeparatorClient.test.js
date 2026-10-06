import { afterEach, describe, expect, it, vi } from 'vitest';
import { StemSeparatorClient } from './stemSeparatorClient';

const audio = () => ({ left: new Float32Array(20), right: new Float32Array(20), channels: 1 });
const setup = () => {
  const worker = { postMessage: vi.fn(), terminate: vi.fn() };
  const create = vi.fn(() => worker);
  return { worker, create, client: new StemSeparatorClient(create) };
};
afterEach(() => vi.useRealTimers());

describe('separation worker lifecycle', () => {
  it('transfers input, forwards actual progress, returns outputs, and reuses the worker', async () => {
    const { worker, client, create } = setup();
    const onProgress = vi.fn(),
      signal = new AbortController().signal;
    const input = audio(),
      onAnalysis = vi.fn();
    const promise = client.separate(input, ['other'], signal, onProgress, onAnalysis);
    expect(worker.postMessage).toHaveBeenCalledWith(
      { ...input, stems: ['other'], cpuOnly: false },
      [input.left.buffer, input.right.buffer]
    );
    worker.onmessage({ data: { type: 'progress', progress: 0.5 } });
    expect(onProgress).toHaveBeenCalledWith({ type: 'progress', progress: 0.5 });
    worker.onmessage({ data: { type: 'analysis', analysis: { key: 'A minor', bpm: 120 } } });
    expect(onAnalysis).toHaveBeenCalledWith({ key: 'A minor', bpm: 120 });
    worker.onmessage({ data: { type: 'result', outputs: [{ id: 'other' }] } });
    expect(await promise).toEqual([{ id: 'other' }]);
    const second = client.separate(audio(), ['bass'], signal);
    worker.onmessage({ data: { type: 'result', outputs: [] } });
    await second;
    expect(create).toHaveBeenCalledTimes(1);
    client.dispose();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
  it('terminates immediately on cancel and ignores stale messages', async () => {
    const { worker, client } = setup();
    const controller = new AbortController(),
      progress = vi.fn(),
      analysis = vi.fn();
    const promise = client.separate(audio(), ['bass'], controller.signal, progress, analysis);
    const rejection = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejection;
    worker.onmessage({ data: { type: 'progress', progress: 1 } });
    worker.onmessage({ data: { type: 'analysis', analysis: {} } });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledWith({ message: 'Starting audio worker', progress: null });
    expect(analysis).not.toHaveBeenCalled();
    expect(client.worker).toBeNull();
  });
  it('rejects worker failures, concurrent calls, and empty selections', async () => {
    const { worker, client } = setup();
    const signal = new AbortController().signal;
    await expect(client.separate(audio(), [], signal)).rejects.toThrow('Select at least one');
    const result = client.separate(audio(), ['drums'], signal);
    await expect(client.separate(audio(), ['drums'], signal)).rejects.toThrow('already processing');
    worker.onmessage({ data: { type: 'error', message: 'Model unavailable' } });
    await expect(result).rejects.toThrow('Model unavailable');
    expect(client.worker).toBeNull();
  });
  it('disposing an active client settles its pending request', async () => {
    const { client } = setup();
    const result = client.separate(audio(), ['vocals'], new AbortController().signal);
    client.dispose();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('times out an unresponsive worker, releases it, and allows retry', async () => {
    vi.useFakeTimers();
    const { client, worker } = setup();
    const failed = expect(
      client.separate(audio(), ['bass'], new AbortController().signal)
    ).rejects.toThrow('stopped responding');
    worker.onmessage({ data: { type: 'progress', message: 'Downloading model' } });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await failed;
    expect(worker.terminate).toHaveBeenCalledOnce();
    const retry = client.separate(
      audio(),
      ['bass'],
      new AbortController().signal,
      undefined,
      undefined,
      true
    );
    expect(worker.postMessage.mock.lastCall[0].cpuOnly).toBe(true);
    worker.onmessage({ data: { type: 'result', outputs: [] } });
    await retry;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('reports a blocked worker startup within 45 seconds', async () => {
    vi.useFakeTimers();
    const { client, worker } = setup();
    const rejected = expect(
      client.separate(audio(), ['bass'], new AbortController().signal)
    ).rejects.toThrow('could not start');
    await vi.advanceTimersByTimeAsync(45000);
    await rejected;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('handles a worker that cannot be created or cannot deserialize a result', async () => {
    const client = new StemSeparatorClient(() => {
      throw new Error('Blocked');
    });
    await expect(client.separate(audio(), ['bass'], new AbortController().signal)).rejects.toThrow(
      'could not start'
    );
    const { client: working, worker } = setup();
    const result = working.separate(audio(), ['bass'], new AbortController().signal);
    worker.onmessageerror();
    await expect(result).rejects.toThrow('could not return');
  });
});
