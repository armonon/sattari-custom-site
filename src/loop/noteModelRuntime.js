import * as ort from 'onnxruntime-web/webgpu';
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import mjs from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = { wasm, mjs };
export { ort };
export async function loadNoteModel(descriptor) {
  const response = await fetch(descriptor.url);
  if (!response.ok) throw new Error('Note model unavailable.');
  const model = await response.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', model));
  if (Array.from(digest, (v) => v.toString(16).padStart(2, '0')).join('') !== descriptor.sha256)
    throw new Error('Note model verification failed.');
  return ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
}
