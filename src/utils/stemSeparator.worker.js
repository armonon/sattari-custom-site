import * as ort from 'onnxruntime-web/webgpu';
import wasmURL from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import wasmModuleURL from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import { StemSeparatorEngine } from './stemSeparatorEngine';
import { SAMPLE_RATE, waveformPeaks } from './stemSeparator';
import { wavBytes } from './arrangementExport';
import { safeAnalyzeStemAudio } from './stemMusicalAnalysis';

// One background worker, one inference at a time. No site-wide isolation headers
// are needed, so external maps, checkout, and the other workspaces stay unchanged.
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = { wasm: wasmURL, mjs: wasmModuleURL };
const progress = (data) => self.postMessage({ type: 'progress', ...data });
const engine = new StemSeparatorEngine(ort, progress);

self.onmessage = async ({ data: { left, right, stems, channels = 2, cpuOnly = false } }) => {
  try {
    progress({ message: 'Analyzing song key and tempo', progress: null });
    self.postMessage({
      type: 'analysis',
      analysis: safeAnalyzeStemAudio(left, right, SAMPLE_RATE, { channels }),
    });
    const result = await engine.separate(left, right, cpuOnly);
    progress({ message: 'Preparing WAV files', progress: null });
    const outputs = stems.map((id) => {
      const channels = [result[id].left, result[id].right];
      progress({ message: `Analyzing ${id === 'other' ? 'instruments' : id}`, progress: null });
      const analysis = safeAnalyzeStemAudio(...channels, SAMPLE_RATE, { stem: id });
      const bytes = wavBytes(
        {
          numberOfChannels: 2,
          length: left.length,
          sampleRate: SAMPLE_RATE,
          getChannelData: (index) => channels[index],
        },
        true
      );
      return {
        id,
        blob: new Blob([bytes], { type: 'audio/wav' }),
        peaks: waveformPeaks(channels),
        analysis,
      };
    });
    self.postMessage({ type: 'result', outputs });
  } catch (error) {
    console.error('Stem separation failed:', error);
    self.postMessage({
      type: 'error',
      message: error?.message || 'Separation failed. Try a shorter track in a desktop browser.',
    });
  }
};
