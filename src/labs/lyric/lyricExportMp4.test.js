import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeLyricMp4 } from './lyricExportMp4';
vi.mock('mp4-muxer', () => ({
  ArrayBufferTarget: class {
    buffer = new ArrayBuffer(8);
  },
  Muxer: class {
    constructor(options) {
      this.target = options.target;
    }
    addVideoChunk() {}
    finalize() {}
  },
}));
let encoders;
beforeEach(() => {
  encoders = [];
  vi.stubGlobal(
    'VideoFrame',
    class {
      close() {}
    }
  );
  vi.stubGlobal(
    'VideoEncoder',
    class {
      static isConfigSupported = vi.fn(async () => ({ supported: true }));
      state = 'unconfigured';
      encodeQueueSize = 0;
      constructor(callbacks) {
        this.callbacks = callbacks;
        encoders.push(this);
      }
      configure(config) {
        this.config = config;
        this.state = 'configured';
      }
      encode() {}
      async flush() {}
      close = vi.fn(() => {
        this.state = 'closed';
      });
    }
  );
});
const options = (width = 1080, height = 1920) => ({
  canvas: { width, height, getContext: () => ({}) },
  durationSeconds: 1,
  drawFrame: vi.fn(),
});
describe('MP4 encoder configuration and failure cleanup', () => {
  it.each([
    [1080, 1920],
    [1920, 1080],
    [1080, 1080],
  ])('uses 1080p-capable H.264 for %s×%s', async (width, height) => {
    await encodeLyricMp4(options(width, height));
    expect(encoders[0].config.codec).toBe('avc1.420028');
    expect(encoders[0].close).toHaveBeenCalledOnce();
  });
  it('retains the lower H.264 level for 720p Canvas exports', async () => {
    await encodeLyricMp4(options(720, 1280));
    expect(encoders[0].config.codec).toBe('avc1.42001f');
  });
  it('reports unsupported output before allocating encoders', async () => {
    VideoEncoder.isConfigSupported.mockResolvedValueOnce({ supported: false });
    await expect(encodeLyricMp4(options())).rejects.toThrow('cannot encode 1080×1920');
    expect(encoders).toHaveLength(0);
  });
  it('rejects an asynchronous codec error while waiting for backpressure', async () => {
    VideoEncoder.prototype.encode = function () {
      this.encodeQueueSize = 5;
      queueMicrotask(() => {
        this.state = 'closed';
        this.callbacks.error(new Error('Codec failed'));
      });
    };
    await expect(encodeLyricMp4(options())).rejects.toThrow('Codec failed');
  });
  it('closes the encoder when rendering a frame fails', async () => {
    await expect(
      encodeLyricMp4({
        ...options(),
        drawFrame: () => {
          throw new Error('Render failed');
        },
      })
    ).rejects.toThrow('Render failed');
    expect(encoders[0].close).toHaveBeenCalledOnce();
  });
});
