import workletUrl from './pcmCapture.worklet.js?url&no-inline';

const abortError = () => new DOMException('Recording cancelled', 'AbortError');
const modules = new WeakMap();

export async function preparePcmCapture(context, { signal } = {}) {
  if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined')
    throw new Error(
      'Strum checks need a browser with AudioWorklet support. You can still check each string.'
    );
  if (signal?.aborted) throw abortError();
  if (!modules.has(context)) {
    const pending = context.audioWorklet.addModule(workletUrl).catch((error) => {
      modules.delete(context);
      throw error;
    });
    modules.set(context, pending);
  }
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(abortError());
    const timeout = setTimeout(
      () => finish(new Error('The recorder could not load. Check your connection and try again.')),
      10000
    );
    signal?.addEventListener('abort', abort, { once: true });
    modules.get(context).then(() => finish(), finish);
    if (signal?.aborted) abort();
  });
}

export async function capturePcm(
  context,
  source,
  { seconds = 2.5, signal, onProgress = () => {} } = {}
) {
  await preparePcmCapture(context, { signal });
  if (signal?.aborted) throw abortError();
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    let settled = false;
    const node = new AudioWorkletNode(context, 'loop-pcm-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
    });
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      node.port.onmessage = null;
      node.port.postMessage({ type: 'cancel' });
      try {
        source.disconnect(node);
      } catch {
        /* Source may already have been released. */
      }
      node.disconnect();
      node.port.close();
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };
    const abort = () => finish(abortError());
    const timer = setTimeout(
      () =>
        finish(
          new Error('The audio input stopped responding. Reconnect your microphone and try again.')
        ),
      (Math.max(0.5, Math.min(60, Number(seconds) || 2.5)) + 10) * 1000
    );
    signal?.addEventListener('abort', abort, { once: true });
    node.onprocessorerror = () =>
      finish(new Error('Recording could not finish. Reconnect your microphone and try again.'));
    node.port.onmessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.type === 'progress') onProgress(data.progress);
      if (data.type === 'complete') finish(null, data);
    };
    try {
      source.connect(node);
      node.connect(context.destination);
      node.port.postMessage({ type: 'record', id, seconds });
      if (signal?.aborted) abort();
    } catch (error) {
      finish(error);
    }
  });
}
