import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { StemSeparatorEngine } from './stemSeparatorEngine';
import { loadSeparationModel } from './stemSeparatorModel';

const { instances, load, infer } = vi.hoisted(() => ({
  instances: [],
  load: vi.fn(),
  infer: vi.fn(),
}));
vi.mock('./stemSeparatorModel', () => ({ loadSeparationModel: vi.fn() }));
vi.mock('demucs-web', () => ({
  CONSTANTS: { TRAINING_SAMPLES: 100, SEGMENT_OVERLAP: 0.25 },
  DemucsProcessor: class {
    constructor(options) {
      this.options = options;
      this.session = { run: vi.fn(infer), release: vi.fn() };
      this.input = { dispose: vi.fn() };
      this.output = { dispose: vi.fn() };
      this.session.run.mockResolvedValue({ output: this.output });
      this.originalRun = this.session.run;
      instances.push(this);
    }
    async loadModel(model) {
      return load(model, this.options);
    }
    async separate(left, right) {
      await this.session.run({ input: this.input });
      this.onProgress({ currentSegment: 1 });
      return { left, right };
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  instances.length = 0;
  load.mockReset();
  loadSeparationModel.mockResolvedValue(new ArrayBuffer(8));
  vi.stubGlobal('navigator', { gpu: { requestAdapter: vi.fn(async () => ({})) } });
});
afterEach(() => vi.unstubAllGlobals());
const audio = () => new Float32Array(120);

it('reuses the model across a batch and releases all input/output tensors', async () => {
  const progress = vi.fn();
  const engine = new StemSeparatorEngine({}, progress);
  const left = audio(),
    right = audio();
  expect(await engine.separate(left, right)).toEqual({ left, right });
  await engine.separate(left, right);
  expect(loadSeparationModel).toHaveBeenCalledTimes(1);
  expect(instances[0].input.dispose).toHaveBeenCalledTimes(2);
  expect(instances[0].output.dispose).toHaveBeenCalledTimes(2);
  expect(instances[0].session.run).toBe(instances[0].originalRun);
  expect(progress).toHaveBeenCalledWith({
    message: 'Separating on GPU: 1 of 2 sections',
    progress: 0.5,
  });
});

it('falls back when GPU initialization fails and labels the actual CPU backend', async () => {
  load.mockRejectedValueOnce(new Error('Unsupported GPU'));
  const engine = new StemSeparatorEngine({}, vi.fn());
  await engine.separate(audio(), audio());
  expect(instances[1].options.sessionOptions.executionProviders).toEqual(['wasm']);
  expect(engine.backend).toBe('CPU');
});

it('retries the intact audio on CPU after a GPU inference failure', async () => {
  const progress = vi.fn();
  const engine = new StemSeparatorEngine({}, progress);
  await engine.init();
  instances[0].session.run.mockRejectedValueOnce(new Error('GPU device lost'));
  const left = audio(),
    right = audio();
  expect(await engine.separate(left, right)).toEqual({ left, right });
  expect(instances[0].session.release).toHaveBeenCalledOnce();
  expect(instances[0].input.dispose).toHaveBeenCalledOnce();
  expect(instances[0].session.run).toBe(instances[0].originalRun);
  expect(instances[1].options.sessionOptions.executionProviders).toEqual(['wasm']);
  expect(progress).toHaveBeenCalledWith({
    message: 'GPU processing failed. Retrying on CPU',
    progress: null,
  });
  await engine.separate(left, right);
  expect(instances).toHaveLength(2);
});

it('honors CPU compatibility mode without probing the GPU', async () => {
  const engine = new StemSeparatorEngine({}, vi.fn());
  await engine.separate(audio(), audio(), true);
  expect(navigator.gpu.requestAdapter).not.toHaveBeenCalled();
  expect(instances[0].options.sessionOptions.executionProviders).toEqual(['wasm']);
});

it('surfaces CPU failures without an infinite fallback loop and still cleans up', async () => {
  const engine = new StemSeparatorEngine({}, vi.fn());
  await engine.init(true);
  instances[0].session.run.mockRejectedValueOnce(new Error('Out of memory'));
  await expect(engine.separate(audio(), audio())).rejects.toThrow('Out of memory');
  expect(instances).toHaveLength(1);
  expect(instances[0].input.dispose).toHaveBeenCalledOnce();
  expect(instances[0].session.run).toBe(instances[0].originalRun);
});
