// Pin both the model revision and checksum so a remote update cannot change inference.
export const MODEL_URL =
  'https://huggingface.co/timcsy/demucs-web-onnx/resolve/92e33df61cfc9eb820272aaa62d2ef6dcf4d950d/htdemucs_embedded.onnx';
export const MODEL_BYTES = 180534758;
export const MODEL_SHA256 = 'e5e425c17683f163a472462eb5f5a4ffcd11c31858d57fbd0833b012d8b88077';
const CACHE = 'sattari-demucs-v1';

export async function loadSeparationModel(onProgress) {
  let cache;
  try {
    cache = await globalThis.caches?.open(CACHE);
  } catch {
    /* Private browsing can disable caching. */
  }
  let response = await cache?.match(MODEL_URL);
  const cached = Boolean(response);
  if (!response) {
    onProgress({ message: 'Downloading separation model', progress: null });
    try {
      response = await fetch(MODEL_URL);
    } catch {
      throw new Error('Could not download the AI model. Check your connection and retry.');
    }
  }
  if (!response.ok)
    throw new Error(`Model download failed (${response.status}). Please retry later.`);
  const data = new Uint8Array(MODEL_BYTES);
  let offset = 0;
  let previousPercent = -1;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
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
  } finally {
    reader.releaseLock();
  }
  if (offset !== MODEL_BYTES) {
    await cache?.delete(MODEL_URL);
    throw new Error('The model download was incomplete. Check your connection and retry.');
  }
  onProgress({ message: 'Verifying separation model', progress: null });
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
  if (hash !== MODEL_SHA256) {
    await cache?.delete(MODEL_URL);
    throw new Error('Model verification failed. Please retry the download.');
  }
  if (!cached) {
    try {
      await cache?.put(
        MODEL_URL,
        new Response(data, { headers: { 'Content-Type': 'application/octet-stream' } })
      );
    } catch {
      /* A full cache must not prevent separation. */
    }
  }
  return data.buffer;
}
