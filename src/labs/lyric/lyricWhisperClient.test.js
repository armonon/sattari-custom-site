import { describe, expect, it, vi } from 'vitest';
import { LyricWhisperClient } from './lyricWhisperClient';

function fixture(postError) {
  const worker = {
    postMessage: vi.fn(() => {
      if (postError) throw postError;
    }),
    terminate: vi.fn(),
  };
  const client = new LyricWhisperClient(() => worker);
  const controller = new AbortController();
  const promise = client.transcribe(new Float32Array(8), 16000, controller.signal);
  return { worker, client, controller, promise, id: worker.postMessage.mock.calls[0][0].id };
}

describe('transcription worker lifetime', () => {
  it('releases the worker after successful transcription', async () => {
    const { worker, promise, id } = fixture();
    worker.onmessage({ data: { id, type: 'done', chunks: [{ text: 'hello' }] } });
    await expect(promise).resolves.toEqual([{ text: 'hello' }]);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('releases the worker after a model error', async () => {
    const { worker, promise, id } = fixture();
    worker.onmessage({ data: { id, type: 'error', message: 'Model unavailable' } });
    await expect(promise).rejects.toThrow('Model unavailable');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('releases a crashed worker', async () => {
    const { worker, promise } = fixture();
    worker.onerror({ message: 'Worker crashed' });
    await expect(promise).rejects.toThrow('Worker crashed');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('cancels and releases the worker exactly once', async () => {
    const { worker, promise, controller } = fixture();
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('releases the worker when posting the request fails', async () => {
    const { worker, promise } = fixture(new Error('Could not post audio'));
    await expect(promise).rejects.toThrow('Could not post audio');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
