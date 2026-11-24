import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import CleanPage from './CleanPage';
const mock = vi.hoisted(() => ({
  decode: vi.fn(),
  stop: vi.fn(),
  close: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('../audio/AudioLabShell', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../audio/AudioLabParts', () => ({
  formatTime: String,
  LabWaveform: () => null,
  LabDrop: ({ onFiles }) => (
    <input
      type="file"
      aria-label="Recording file"
      onChange={(e) => onFiles(Array.from(e.target.files))}
    />
  ),
}));
vi.mock('../audio/audioLabFiles', () => ({
  baseName: String,
  decodeMono: (...args) => mock.decode(...args),
  downloadBlob: vi.fn(),
  isAudioFile: () => true,
  LAB_RATE: 44100,
  peaksOf: () => [],
  wavBlob: vi.fn(),
}));
vi.mock('../vox/useVoxRecorder', () => ({ default: () => ({ status: 'idle' }) }));
vi.mock('./cleanDsp', () => ({
  LOUDNESS_PRESETS: { podcast: { label: 'Podcast', targetLufs: -16, targetPeakDb: -1 } },
  autoDetectNoiseWindow: () => ({ startSeconds: 0, endSeconds: 1 }),
  estimateNoiseProfile: () => ({}),
  processChain: (samples) => ({
    samples,
    before: { integrated: -20, truePeak: -2 },
    after: { integrated: -16, truePeak: -1 },
  }),
}));
const decoded = { samples: new Float32Array(8), rate: 44100, duration: 4 };
const choose = (name) =>
  fireEvent.change(screen.getByLabelText('Recording file'), {
    target: { files: [new File(['audio'], name, { type: 'audio/wav' })] },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.decode.mockResolvedValue(decoded);
  vi.stubGlobal(
    'AudioContext',
    class {
      destination = {};
      createBuffer() {
        return { copyToChannel() {} };
      }
      createGain() {
        return { gain: {}, connect() {}, disconnect: mock.disconnect };
      }
      createBufferSource() {
        return {
          connect: () => ({ connect() {} }),
          start() {},
          stop: mock.stop,
          disconnect: mock.disconnect,
        };
      }
      close = mock.close;
    }
  );
  mock.close.mockResolvedValue();
});
afterEach(() => vi.unstubAllGlobals());
it('stops playback and closes its context when leaving Clean', async () => {
  const view = render(<CleanPage />);
  choose('first.wav');
  await screen.findByText('first.wav');
  fireEvent.click(screen.getByRole('button', { name: 'Clean it up' }));
  await screen.findByRole('button', { name: 'Export WAV' });
  fireEvent.click(screen.getByRole('button', { name: 'Cleaned', exact: true }));
  view.unmount();
  expect(mock.stop).toHaveBeenCalledOnce();
  expect(mock.close).toHaveBeenCalledOnce();
});
it('keeps the newest recording when older decoding finishes last', async () => {
  let first;
  mock.decode.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        first = resolve;
      })
  );
  render(<CleanPage />);
  choose('first.wav');
  choose('second.wav');
  await screen.findByText('second.wav');
  await act(async () => first(decoded));
  expect(screen.getByText('second.wav')).toBeInTheDocument();
  expect(screen.queryByText('first.wav')).not.toBeInTheDocument();
});
it('hides the prior source while loading a replacement that fails', async () => {
  render(<CleanPage />);
  choose('first.wav');
  await screen.findByText('first.wav');
  let reject;
  mock.decode.mockImplementationOnce(
    () =>
      new Promise((resolve, fail) => {
        reject = fail;
      })
  );
  choose('invalid.wav');
  expect(screen.queryByText('first.wav')).not.toBeInTheDocument();
  await act(async () => reject(new Error('Cannot decode')));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Clean it up' })).not.toBeInTheDocument();
});
