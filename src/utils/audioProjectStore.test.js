/* @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { blobToDataUrl, dataUrlToBlob } from './audioProjectStore';

describe('portable audio assets', () => {
  it('round-trips an embedded audio blob without losing its type or bytes', async () => {
    const original = new Blob([new Uint8Array([12, 42, 128, 255])], { type: 'audio/wav' });
    const encoded = await blobToDataUrl(original);
    const restored = dataUrlToBlob(encoded);

    expect(restored.type).toBe('audio/wav');
    expect(Array.from(new Uint8Array(await restored.arrayBuffer()))).toEqual([12, 42, 128, 255]);
  });

  it('rejects damaged embedded asset data', () => {
    expect(() => dataUrlToBlob('not-a-data-url')).toThrow('damaged audio asset');
  });
});
