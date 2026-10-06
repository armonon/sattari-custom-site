import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decodeTrack,
  DECODE_TIMEOUT_MS,
  LIMITS,
  safeTrackName,
  selectedStemIds,
  validateFiles,
  waveformPeaks,
} from './stemSeparator';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const file = (name = 'mix.wav', size = 100, type = 'audio/wav') => ({
  name,
  size,
  type,
  lastModified: 1,
});

describe('stem separator inputs', () => {
  it('accepts a batch and de-duplicates against itself and the existing queue', () => {
    const mix = file();
    const result = validateFiles(
      [mix, mix, file('second.mp3', 100, '')],
      [{ file: file('old.wav') }]
    );
    expect(result.accepted).toHaveLength(2);
    expect(result.errors).toEqual(['mix.wav: Already in the queue.']);
    expect(validateFiles([mix], [{ file: mix }]).accepted).toHaveLength(0);
  });
  it('rejects empty, unsupported, oversized, and excess files without discarding valid ones', () => {
    const result = validateFiles([
      file('empty.wav', 0),
      file('photo.png', 1, 'image/png'),
      file('big.wav', LIMITS.fileBytes + 1),
      file(),
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.errors).toHaveLength(3);
    expect(
      validateFiles(
        [file()],
        Array.from({ length: 20 }, (_, i) => ({ file: file(`${i}.wav`) }))
      ).errors[0]
    ).toMatch('Maximum 20');
    expect(
      validateFiles([file('new.wav')], [{ file: file('large.wav', LIMITS.inputBytes) }]).errors[0]
    ).toMatch('300 MB');
  });
  it('maps only the selected stems, in stable output order', () => {
    expect(selectedStemIds(['drums', 'bad', 'vocals', 'vocals'])).toEqual(['vocals', 'drums']);
    expect(selectedStemIds([])).toEqual([]);
  });
  it('creates safe filenames and genuine waveform peaks', () => {
    expect(safeTrackName('../bad/name.wav')).not.toMatch(/[/\\]/);
    expect(safeTrackName('.wav')).toBe('track');
    expect([...waveformPeaks([new Float32Array([-0.5, 0.2, 0, 0.7])], 2)]).toEqual([
      0.5,
      expect.closeTo(0.7),
    ]);
  });
  it('decodes at the model sample rate and makes independent stereo arrays for mono', async () => {
    const constructor = vi.fn();
    const samples = new Float32Array([0.2, 0.4]);
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        constructor(...args) {
          constructor(...args);
        }
        decodeAudioData() {
          return Promise.resolve({
            length: 2,
            duration: 0.001,
            numberOfChannels: 1,
            getChannelData: () => samples,
          });
        }
      }
    );
    try {
      const result = await decodeTrack(
        { arrayBuffer: async () => new ArrayBuffer(1) },
        new AbortController().signal
      );
      expect(constructor).toHaveBeenCalledWith(2, 1, 44100);
      expect(result.channels).toBe(1);
      expect(result.left).toEqual(result.right);
      expect(result.left.buffer).not.toBe(result.right.buffer);
      expect(result.left.buffer).not.toBe(samples.buffer);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('does not decode after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const arrayBuffer = vi.fn();
    await expect(decodeTrack({ arrayBuffer }, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it('Stop settles a decoder that never returns, and removes its timer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        decodeAudioData() {
          return new Promise(() => {});
        }
      }
    );
    const controller = new AbortController();
    const rejection = expect(
      decodeTrack({ arrayBuffer: async () => new ArrayBuffer(1) }, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds file reading and reports timeout instead of waiting forever', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('OfflineAudioContext', class {});
    const rejection = expect(
      decodeTrack({ arrayBuffer: () => new Promise(() => {}) }, new AbortController().signal)
    ).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(DECODE_TIMEOUT_MS);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});
