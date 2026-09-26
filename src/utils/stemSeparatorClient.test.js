import { describe, expect, it, vi } from 'vitest';
import { StemSeparatorClient } from './stemSeparatorClient';

const audio = () => ({ left: new Float32Array(20), right: new Float32Array(20), channels: 1 });
const setup = () => {
  const worker = { postMessage: vi.fn(), terminate: vi.fn() };
  const create = vi.fn(() => worker);
  return { worker, create, client: new StemSeparatorClient(create) };
};

describe('separation worker lifecycle', () => {
  it('transfers input, forwards actual progress, returns outputs, and reuses the worker', async () => {
    const { worker, client, create } = setup();
    const onProgress = vi.fn(),
      signal = new AbortController().signal;
    const input = audio(),
      onAnalysis = vi.fn();
    const promise = client.separate(input, ['other'], signal, onProgress, onAnalysis);
    expect(worker.postMessage).toHaveBeenCalledWith({ ...input, stems: ['other'] }, [
      input.left.buffer,
      input.right.buffer,
    ]);
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
    expect(progress).not.toHaveBeenCalled();
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
});
