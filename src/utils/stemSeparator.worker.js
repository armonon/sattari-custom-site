import * as ort from 'onnxruntime-web/webgpu';
import wasmURL from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import wasmModuleURL from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import { DemucsProcessor, CONSTANTS } from 'demucs-web';
import { loadSeparationModel } from './stemSeparatorModel';
import { SAMPLE_RATE, waveformPeaks } from './stemSeparator';
import { wavBytes } from './arrangementExport';

// One background worker, one inference at a time. No site-wide isolation headers
// are needed, so external maps, checkout, and the other workspaces stay unchanged.
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = { wasm: wasmURL, mjs: wasmModuleURL };
let processor;
let backend = 'CPU';
const progress = (data) => self.postMessage({ type: 'progress', ...data });

async function init() {
  if (processor) return;
  const model = await loadSeparationModel(progress);
  progress({ message: 'Starting separation engine', progress: null });
  let gpu = false;
  try {
    gpu = Boolean(await navigator.gpu?.requestAdapter());
  } catch {
    /* CPU fallback. */
  }
  const create = async (useGPU) => {
    const instance = new DemucsProcessor({
      ort,
      sessionOptions: {
        executionProviders: useGPU ? ['webgpu', 'wasm'] : ['wasm'],
        enableCpuMemArena: false,
        enableMemPattern: false,
      },
    });
    await instance.loadModel(model);
    return instance;
  };
  try {
    processor = await create(gpu);
    backend = gpu ? 'GPU' : 'CPU';
  } catch (error) {
    if (!gpu) throw error;
    progress({ message: 'Starting CPU engine', progress: null });
    processor = await create(false);
  }
}

self.onmessage = async ({ data: { left, right, stems } }) => {
  let tensors = [];
  let session, run;
  try {
    await init();
    const segments = Math.ceil(
      left.length / Math.floor(CONSTANTS.TRAINING_SAMPLES * (1 - CONSTANTS.SEGMENT_OVERLAP))
    );
    progress({ message: `Separating on ${backend}: section 1 of ${segments}`, progress: 0 });
    processor.onProgress = ({ currentSegment }) =>
      progress({
        message: `Separating on ${backend}: ${currentSegment} of ${segments} sections`,
        progress: Math.min(1, currentSegment / segments),
      });
    // demucs-web 1.0.2 leaves ORT tensors alive between chunks. Release each
    // completed chunk before allocating the next, including the final chunk.
    session = processor.session;
    run = session.run.bind(session);
    session.run = async (feeds) => {
      tensors.forEach((tensor) => tensor.dispose());
      tensors = [];
      try {
        const result = await run(feeds);
        tensors = Object.values(result);
        return result;
      } finally {
        Object.values(feeds).forEach((tensor) => tensor.dispose());
      }
    };
    const result = await processor.separate(left, right);
    progress({ message: 'Preparing WAV files', progress: null });
    const outputs = stems.map((id) => {
      const channels = [result[id].left, result[id].right];
      const bytes = wavBytes(
        {
          numberOfChannels: 2,
          length: left.length,
          sampleRate: SAMPLE_RATE,
          getChannelData: (index) => channels[index],
        },
        true
      );
      return { id, blob: new Blob([bytes], { type: 'audio/wav' }), peaks: waveformPeaks(channels) };
    });
    self.postMessage({ type: 'result', outputs });
  } catch (error) {
    console.error('Stem separation failed:', error);
    self.postMessage({
      type: 'error',
      message: error?.message || 'Separation failed. Try a shorter track in a desktop browser.',
    });
  } finally {
    tensors.forEach((tensor) => tensor.dispose());
    if (session && run) session.run = run;
  }
};
