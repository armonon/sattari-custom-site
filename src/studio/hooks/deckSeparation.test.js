import { describe, expect, it, vi } from 'vitest';
import { separateDeckAsset } from './deckSeparation';

describe('Songboard deck separation', () => {
  it('turns the stored full mix into four lane-named files through the verified worker', async () => {
    const signal = new AbortController().signal;
    const dispose = vi.fn();
    const separate = vi.fn(async (_audio, stems) =>
      stems.map((id) => ({ id, blob: new Blob([id], { type: 'audio/wav' }) }))
    );
    const files = await separateDeckAsset({
      deck: {
        title: 'Night Drive',
        lanes: { fullMix: { assetId: 'source-1' } },
      },
      signal,
      readAsset: async () => ({
        blob: new Blob(['mix'], { type: 'audio/wav' }),
        name: 'Night Drive.wav',
        type: 'audio/wav',
      }),
      decode: async () => ({ left: new Float32Array(4), right: new Float32Array(4), channels: 2 }),
      createClient: () => ({ separate, dispose }),
    });

    expect(separate).toHaveBeenCalledWith(
      expect.anything(),
      ['vocals', 'drums', 'bass', 'other'],
      signal,
      expect.any(Function),
      expect.any(Function),
      false
    );
    expect(files.map((file) => file.name)).toEqual([
      'Night Drive-vocals.wav',
      'Night Drive-drums.wav',
      'Night Drive-bass.wav',
      'Night Drive-music.wav',
    ]);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('refuses to invent stems when the original asset is unavailable', async () => {
    await expect(
      separateDeckAsset({
        deck: { lanes: { fullMix: { assetId: '' } } },
        signal: new AbortController().signal,
      })
    ).rejects.toThrow('Load an original track');
  });
});
