import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LyricPage from './LyricPage';

const state = vi.hoisted(() => ({
  decode: vi.fn(),
  buffer: vi.fn(),
  transcribe: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock('../audio/AudioLabShell', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../audio/AudioLabParts', () => ({
  formatTime: String,
  LabDrop: ({ onFiles, disabled }) => (
    <input
      aria-label="Song"
      type="file"
      disabled={disabled}
      onChange={(e) => onFiles(Array.from(e.target.files))}
    />
  ),
}));
vi.mock('../audio/audioLabFiles', () => ({
  decodeMono: (...args) => state.decode(...args),
  peaksOf: () => [],
  baseName: String,
  downloadBlob: vi.fn(),
}));
vi.mock('./lyricAudio', () => ({ decodeAudioBuffer: (...args) => state.buffer(...args) }));
vi.mock('./lyricWhisperClient', () => ({
  LyricWhisperClient: class {
    transcribe(...args) {
      return state.transcribe(...args);
    }
    dispose() {
      state.dispose();
    }
  },
}));

const song = (name) => new File(['audio'], name, { type: 'audio/wav' });
async function loadSong() {
  fireEvent.change(screen.getByLabelText('Song'), { target: { files: [song('first.wav')] } });
  await screen.findByPlaceholderText('Paste the song lyrics here, one line per lyric line...');
}

beforeEach(() => {
  vi.clearAllMocks();
  state.decode.mockResolvedValue({ samples: new Float32Array(8), rate: 16000, duration: 4 });
  state.buffer.mockResolvedValue({ duration: 4 });
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
});

describe('replacing a song during alignment', () => {
  it('cancels the old alignment before the replacement finishes decoding', async () => {
    let activeSignal;
    state.transcribe.mockImplementation((samples, rate, signal) => {
      activeSignal = signal;
      return new Promise((resolve, reject) =>
        signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))
      );
    });
    render(<LyricPage />);
    await loadSong();
    fireEvent.change(
      screen.getByPlaceholderText('Paste the song lyrics here, one line per lyric line...'),
      { target: { value: 'hello world' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Align lyrics' }));
    await waitFor(() => expect(activeSignal).toBeDefined());
    let finishDecode;
    state.decode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDecode = resolve;
        })
    );
    fireEvent.change(screen.getByLabelText('Song'), { target: { files: [song('second.wav')] } });
    expect(activeSignal.aborted).toBe(true);
    expect(screen.queryByRole('button', { name: 'Align lyrics' })).not.toBeInTheDocument();
    await act(async () => finishDecode({ samples: new Float32Array(8), rate: 16000, duration: 2 }));
    await screen.findByRole('button', { name: 'Align lyrics' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('does not expose old-song alignment controls while decoding a replacement', async () => {
    render(<LyricPage />);
    await loadSong();
    let finishDecode;
    state.decode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDecode = resolve;
        })
    );
    fireEvent.change(screen.getByLabelText('Song'), { target: { files: [song('invalid.wav')] } });
    expect(
      screen.queryByPlaceholderText('Paste the song lyrics here, one line per lyric line...')
    ).not.toBeInTheDocument();
    await act(async () => finishDecode(Promise.reject(new Error('Cannot decode audio'))));
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Align lyrics' })).not.toBeInTheDocument();
  });
});
