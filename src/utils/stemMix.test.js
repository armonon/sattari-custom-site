import { describe, expect, it } from 'vitest';
import { wavBytes } from './arrangementExport';
import {
  applyPreset,
  audibleLanes,
  createMix,
  describeMix,
  laneGain,
  mixFileName,
  mixPeak,
  mixWavBlob,
  parseWav,
  renderMix,
  soloMix,
} from './stemMix';

const RATE = 44100;
const ids = ['vocals', 'drums', 'bass', 'other'];
// Each stem is a distinct constant so sums identify exactly which parts are in.
const level = { vocals: 0.1, drums: 0.02, bass: 0.004, other: 0.0008 };
const fixture = (frames = 1000, rate = RATE) =>
  Object.fromEntries(
    ids.map((id) => [
      id,
      {
        sampleRate: rate,
        channels: [
          new Float32Array(frames).fill(level[id]),
          new Float32Array(frames).fill(-level[id]),
        ],
      },
    ])
  );
const sum = (parts) => parts.reduce((total, id) => total + level[id], 0);

describe('mix rule', () => {
  it('mute wins over solo and solo isolates unmuted lanes', () => {
    let mix = createMix(ids);
    expect(audibleLanes(mix)).toEqual(ids);
    mix = soloMix(mix, 'bass');
    expect(audibleLanes(mix)).toEqual(['bass']);
    mix.lanes.bass.muted = true;
    // The only soloed lane is muted, so no solo is in effect.
    expect(audibleLanes(mix)).toEqual(['vocals', 'drums', 'other']);
    mix.lanes.vocals.solo = true;
    expect(audibleLanes(mix)).toEqual(['vocals']);
  });

  it('multiplies lane and master gain', () => {
    const mix = createMix(ids);
    mix.lanes.drums.gain = 0.5;
    mix.master = 0.8;
    expect(laneGain(mix, 'drums')).toBeCloseTo(0.4);
    expect(laneGain(mix, 'missing')).toBe(0);
  });

  it('presets describe practice tracks on supported stems', () => {
    const base = createMix(ids);
    expect(audibleLanes(applyPreset(base, 'no-vocals'))).toEqual(['drums', 'bass', 'other']);
    expect(audibleLanes(applyPreset(base, 'no-drums'))).toEqual(['vocals', 'bass', 'other']);
    expect(audibleLanes(applyPreset(base, 'no-bass'))).toEqual(['vocals', 'drums', 'other']);
    expect(describeMix(applyPreset(base, 'no-bass')).id).toBe('no-bass');
    expect(describeMix(soloMix(base, 'other')).id).toBe('solo:other');
    const custom = applyPreset(base, 'no-drums');
    custom.lanes.bass.gain = 0.7;
    expect(describeMix(custom).id).toBe('custom');
  });

  it('names exports by content', () => {
    const base = createMix(ids);
    expect(mixFileName('song', applyPreset(base, 'no-drums'))).toBe('song-drumless-mix.wav');
    expect(mixFileName('song', soloMix(base, 'other'))).toBe('song-instruments-solo-mix.wav');
  });
});

describe('renderMix', () => {
  it.each([
    ['no-vocals', ['drums', 'bass', 'other']],
    ['no-bass', ['vocals', 'drums', 'other']],
    ['no-drums', ['vocals', 'bass', 'other']],
    ['all', ids],
  ])('%s sums exactly the intended stems', async (preset, parts) => {
    const render = await renderMix(fixture(), applyPreset(createMix(ids), preset));
    expect(render.audible).toEqual(parts);
    expect(render.frames).toBe(1000);
    expect(render.sampleRate).toBe(RATE);
    expect(render.channels[0][0]).toBeCloseTo(sum(parts), 6);
    expect(render.channels[1][999]).toBeCloseTo(-sum(parts), 6);
  });

  it('applies gains and keeps unequal lengths without truncation', async () => {
    const sources = fixture(1000);
    sources.bass.channels = [new Float32Array(1500).fill(0.5), new Float32Array(1500).fill(0.5)];
    const mix = soloMix(createMix(ids), 'bass');
    mix.lanes.bass.gain = 0.5;
    mix.master = 0.5;
    const render = await renderMix(sources, mix, { chunkFrames: 128 });
    expect(render.frames).toBe(1500);
    expect(render.channels[0][1499]).toBeCloseTo(0.125, 6);
  });

  it('pads shorter stems with silence and preserves the sample position', async () => {
    const sources = fixture(10);
    sources.other.channels = [new Float32Array(20).fill(0.25), new Float32Array(20).fill(0.25)];
    const render = await renderMix(sources, applyPreset(createMix(ids), 'no-vocals'));
    expect(render.channels[0][5]).toBeCloseTo(0.25 + level.drums + level.bass, 6);
    expect(render.channels[0][15]).toBeCloseTo(0.25, 6);
  });

  it('refuses an all-muted export instead of producing silence', async () => {
    const mix = createMix(ids);
    ids.forEach((id) => (mix.lanes[id].muted = true));
    await expect(renderMix(fixture(), mix)).rejects.toMatchObject({ code: 'silent' });
    const zero = createMix(ids);
    zero.master = 0;
    await expect(renderMix(fixture(), zero)).rejects.toMatchObject({ code: 'silent' });
  });

  it('reports overload and only applies headroom when asked', async () => {
    const sources = fixture(100);
    sources.vocals.channels = [new Float32Array(100).fill(0.9), new Float32Array(100).fill(0.9)];
    sources.drums.channels = [new Float32Array(100).fill(0.6), new Float32Array(100).fill(0.6)];
    const mix = createMix(['vocals', 'drums']);
    const raw = await renderMix(sources, mix);
    expect(raw.peak).toBeCloseTo(1.5, 5);
    expect(raw.overFrames).toBe(100);
    expect(raw.outputGain).toBe(1);
    const safe = await renderMix(sources, mix, { headroom: 'prevent-clipping' });
    expect(safe.peakDb).toBeCloseTo(-1, 3);
    expect(safe.outputGainDb).toBeLessThan(0);
    expect(safe.overFrames).toBe(0);
    expect(await mixPeak(sources, mix)).toBeCloseTo(1.5, 5);
  });

  it('snapshots settings at start so later edits do not change a running export', async () => {
    const mix = applyPreset(createMix(ids), 'no-vocals');
    const pending = renderMix(fixture(5000), mix, { chunkFrames: 100 });
    mix.lanes.vocals.muted = false;
    const render = await pending;
    expect(render.audible).toEqual(['drums', 'bass', 'other']);
  });

  it('cancels between chunks', async () => {
    const controller = new AbortController();
    const pending = renderMix(fixture(10000), createMix(ids), {
      signal: controller.signal,
      chunkFrames: 100,
      onProgress: (value) => value > 0.2 && controller.abort(),
    });
    await expect(pending).rejects.toThrow();
  });

  it('rejects mixed sample rates', async () => {
    const sources = fixture();
    sources.bass.sampleRate = 48000;
    await expect(renderMix(sources, createMix(ids))).rejects.toMatchObject({ code: 'rate' });
  });
});

describe('WAV round trip', () => {
  it('reads back the exact samples, rate, channels and length of an exported mix', async () => {
    const render = await renderMix(fixture(777), applyPreset(createMix(ids), 'no-drums'));
    for (const format of ['float32', 'pcm24']) {
      const blob = mixWavBlob(render, format);
      const parsed = parseWav(await blob.arrayBuffer());
      expect(parsed.sampleRate).toBe(RATE);
      expect(parsed.channels).toHaveLength(2);
      expect(parsed.channels[0]).toHaveLength(777);
      expect(parsed.bitsPerSample).toBe(format === 'float32' ? 32 : 24);
      expect(parsed.channels[0][100]).toBeCloseTo(sum(['vocals', 'bass', 'other']), 5);
      expect(parsed.channels[1][776]).toBeCloseTo(-sum(['vocals', 'bass', 'other']), 5);
    }
  });

  it('parses the separator stem encoding (32-bit float, 44.1 kHz) and mono 16-bit', () => {
    const data = new Float32Array([0.5, -0.25, 1.25]);
    const stem = parseWav(
      wavBytes(
        { numberOfChannels: 1, length: 3, sampleRate: RATE, getChannelData: () => data },
        true
      ).buffer
    );
    expect(Array.from(stem.channels[0])).toEqual([0.5, -0.25, 1.25]);
    expect(() => parseWav(new ArrayBuffer(10))).toThrow();
  });
});
