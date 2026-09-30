// Pin both the model revision and checksum so a remote update cannot change inference.
export const MODEL_URL =
  'https://huggingface.co/timcsy/demucs-web-onnx/resolve/92e33df61cfc9eb820272aaa62d2ef6dcf4d950d/htdemucs_embedded.onnx';
export const MODEL_BYTES = 180534758;
export const MODEL_SHA256 = 'e5e425c17683f163a472462eb5f5a4ffcd11c31858d57fbd0833b012d8b88077';
const CACHE = 'sattari-demucs-v1';
const DOWNLOAD_IDLE_MS = 45000;

async function readModel(response, onProgress, cached, touch = () => {}) {
  if (!response.ok)
    throw new Error(`Model download failed (${response.status}). Please retry later.`);
  if (!response.body) throw new Error('The model download was empty. Please retry.');
  const data = new Uint8Array(MODEL_BYTES);
  let offset = 0;
  let previousPercent = -1;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      touch();
      if (offset + value.length > data.length) throw new Error('Invalid model download size.');
      data.set(value, offset);
      offset += value.length;
      const percent = Math.floor((offset / MODEL_BYTES) * 100);
      if (percent !== previousPercent) {
        previousPercent = percent;
        onProgress({
          message: cached
            ? 'Reading cached model'
            : `Downloading model: ${Math.round(offset / 1024 ** 2)} / 172 MB`,
          progress: offset / MODEL_BYTES,
        });
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (offset !== MODEL_BYTES) {
    throw new Error('The model download was incomplete. Check your connection and retry.');
  }
  onProgress({ message: 'Verifying separation model', progress: null });
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
  if (hash !== MODEL_SHA256) {
    throw new Error('Model verification failed. Please retry the download.');
  }
  return data.buffer;
}

export async function loadSeparationModel(onProgress = () => {}) {
  let cache;
  try {
    cache = await globalThis.caches?.open(CACHE);
    const response = await cache?.match(MODEL_URL);
    if (response) return await readModel(response, onProgress, true);
  } catch {
    // Unavailable or corrupt caches must not block a fresh, verified download.
    await cache?.delete(MODEL_URL).catch(() => {});
  }

  onProgress({ message: 'Downloading separation model', progress: null });
  const controller = new AbortController();
  let timer;
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), DOWNLOAD_IDLE_MS);
  };
  let model;
  touch();
  try {
    const response = await fetch(MODEL_URL, { signal: controller.signal });
    model = await readModel(response, onProgress, false, touch);
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error('The model download stalled. Check your connection and retry.', {
        cause: error,
      });
    if (error instanceof TypeError)
      throw new Error('Could not download the AI model. Check your connection and retry.', {
        cause: error,
      });
    throw error;
  } finally {
    clearTimeout(timer);
  }
  try {
    await cache?.put(
      MODEL_URL,
      new Response(model, { headers: { 'Content-Type': 'application/octet-stream' } })
    );
  } catch {
    /* A full cache must not prevent separation. */
  }
  return model;
}
