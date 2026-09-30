import { DemucsProcessor, CONSTANTS } from 'demucs-web';
import { loadSeparationModel } from './stemSeparatorModel';

export class StemSeparatorEngine {
  constructor(ort, onProgress) {
    this.ort = ort;
    this.onProgress = onProgress;
    this.processor = null;
    this.backend = 'CPU';
  }

  async init(cpuOnly = false) {
    if (this.processor) return;
    const model = await loadSeparationModel(this.onProgress);
    this.onProgress({ message: 'Starting separation engine', progress: null });
    let gpu = false;
    if (!cpuOnly) {
      try {
        gpu = Boolean(await navigator.gpu?.requestAdapter());
      } catch {
        /* CPU fallback. */
      }
    }
    const create = async (useGPU) => {
      const instance = new DemucsProcessor({
        ort: this.ort,
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
      this.processor = await create(gpu);
      this.backend = gpu ? 'GPU' : 'CPU';
    } catch (error) {
      if (!gpu) throw error;
      this.onProgress({ message: 'Starting CPU engine', progress: null });
      this.processor = await create(false);
      this.backend = 'CPU';
    }
  }

  async separate(left, right, cpuOnly = false) {
    await this.init(cpuOnly);
    try {
      return await this.process(left, right);
    } catch (error) {
      if (this.backend !== 'GPU') throw error;
      this.onProgress({ message: 'GPU processing failed. Retrying on CPU', progress: null });
      try {
        await this.processor.session.release();
      } catch {
        /* A lost GPU device may also reject cleanup. */
      }
      this.processor = null;
      await this.init(true);
      return this.process(left, right);
    }
  }

  async process(left, right) {
    const segments = Math.ceil(
      left.length / Math.floor(CONSTANTS.TRAINING_SAMPLES * (1 - CONSTANTS.SEGMENT_OVERLAP))
    );
    this.onProgress({
      message: `Separating on ${this.backend}: section 1 of ${segments}`,
      progress: 0,
    });
    this.processor.onProgress = ({ currentSegment }) =>
      this.onProgress({
        message: `Separating on ${this.backend}: ${currentSegment} of ${segments} sections`,
        progress: Math.min(1, currentSegment / segments),
      });

    // demucs-web retains ORT tensors between chunks. Release completed chunks
    // before allocating the next, and release the last chunk even on failure.
    const session = this.processor.session;
    const originalRun = session.run;
    let tensors = [];
    const release = () => {
      for (const tensor of tensors) tensor.dispose();
      tensors = [];
    };
    session.run = async (feeds) => {
      release();
      try {
        const result = await originalRun.call(session, feeds);
        tensors = Object.values(result);
        return result;
      } finally {
        Object.values(feeds).forEach((tensor) => tensor.dispose());
      }
    };
    try {
      return await this.processor.separate(left, right);
    } finally {
      release();
      session.run = originalRun;
    }
  }
}
