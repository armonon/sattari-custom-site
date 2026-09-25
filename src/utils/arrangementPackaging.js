import { wavBytes, zipFiles } from './arrangementExport';
import { pcm24 } from './arrangementStreamExport';
// Encoding/CRC work can be substantial for long sets. Keep it off the UI/audio
// scheduling thread; cancellation terminates the worker without touching assets.
export async function packageAudio(payload, cancelled = () => false, reuse = null) {
  if (cancelled()) throw new Error('Export cancelled.');
  if (typeof Worker === 'undefined') {
    if (payload.type === 'pcm') return pcm24(payload.channels, payload.crc);
    if (payload.type === 'zip') return zipFiles(payload.files);
    return wavBytes(
      {
        ...payload,
        numberOfChannels: payload.channels.length,
        getChannelData: (index) => payload.channels[index],
      },
      payload.type === 'float-wav'
    );
  }
  return new Promise((resolve, reject) => {
    const worker =
      reuse?.current ||
      new Worker(new URL('./arrangementExport.worker.js', import.meta.url), {
        type: 'module',
      });
    if (reuse) reuse.current = worker;
    const finish = (error, value) => {
      clearInterval(timer);
      if (reuse) reuse.cancel = null;
      if (!reuse || error) {
        worker.terminate();
        if (reuse) reuse.current = null;
      }
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setInterval(() => {
      if (cancelled()) finish(new Error('Export cancelled.'));
    }, 100);
    if (reuse) reuse.cancel = () => finish(new Error('Recording encoder stopped.'));
    worker.onmessage = ({ data }) => {
      if (reuse) reuse.recycled = data.recycled;
      finish(data.error ? new Error(data.error) : null, data.result);
    };
    worker.onerror = () =>
      finish(new Error('Audio export worker failed. Your project and source audio are unchanged.'));
    const transfers =
      payload.type !== 'zip'
        ? payload.channels.map((channel) => channel.buffer)
        : payload.files.map((file) => file.data.buffer);
    try {
      worker.postMessage(payload, transfers);
    } catch (error) {
      finish(error);
    }
  });
}
