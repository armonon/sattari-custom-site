import { describe, it, expect, vi } from 'vitest';
vi.mock('../lyric/lyricExportMp4', () => ({ encodeLyricMp4: vi.fn(async (options) => options) }));
import { encodeCanvasMp4, loopAudio } from './canvasExportMp4';

describe('Canvas fixed timeline export', () => {
  it('crops each audio channel to the selected loop without changing the source', () => {
    const channels = [
      Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
      Float32Array.from([7, 6, 5, 4, 3, 2, 1, 0]),
    ];
    const buffer = {
      sampleRate: 2,
      length: 8,
      numberOfChannels: 2,
      getChannelData: (c) => channels[c],
    };
    const context = {
      createBuffer: vi.fn((count, frames, rate) => ({
        count,
        frames,
        rate,
        data: [],
        copyToChannel(samples, c) {
          this.data[c] = Array.from(samples);
        },
      })),
    };
    const result = loopAudio(buffer, 1, 2, context);
    expect(result.data).toEqual([
      [2, 3, 4, 5],
      [5, 4, 3, 2],
    ]);
    expect(result.frames / result.rate).toBe(2);
    expect(Array.from(channels[0])).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(() => loopAudio(buffer, 4, 1, context)).toThrow('empty');
  });
  it('passes the complete selected duration to a separate export canvas', async () => {
    const result = await encodeCanvasMp4({
      size: { width: 720, height: 1280 },
      settings: { view: { length: 4 } },
    });
    expect(result.durationSeconds).toBe(4);
    expect(result.fps).toBe(30);
    expect(result.canvas.width).toBe(720);
    expect(result.canvas.height).toBe(1280);
    expect(result.canvas.isConnected).toBe(false);
    expect(result.audioBuffer).toBeUndefined();
  });
});
