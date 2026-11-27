// @vitest-environment node
import { expect, it } from 'vitest';
import { createReferenceWav, createScaleWav } from './referenceWave';

it.each([82.406889, 329.627557])(
  'encodes a pitched, seamless guitar E at %f Hz',
  async (frequency) => {
    const blob = createReferenceWav(frequency);
    expect(blob.type).toBe('audio/wav');
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    expect(new TextDecoder().decode(buffer.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(buffer.slice(8, 12))).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    const rate = view.getUint32(24, true);
    const frames = view.getUint32(40, true) / 2;
    expect(buffer.byteLength).toBe(44 + frames * 2);
    const sample = (i) => view.getInt16(44 + i * 2, true);
    let cycles = 0;
    for (let i = 0; i < frames; i++)
      if (sample((i + frames - 1) % frames) <= 0 && sample(i) > 0) cycles++;
    const measured = (cycles * rate) / frames;
    expect(Math.abs(1200 * Math.log2(measured / frequency))).toBeLessThan(0.1);
    expect(sample(0)).toBe(0);
    expect(sample(1)).toBeGreaterThan(0);
    expect(Math.abs(sample(frames - 1) + sample(1))).toBeLessThanOrEqual(1);
  }
);

it('renders each finite note at the requested pitch, with silent ends and gaps between notes', async () => {
  const frequencies = [82.406889, 110, 329.627557, 440];
  const data = new DataView(await createScaleWav(frequencies).arrayBuffer());
  const rate = data.getUint32(24, true);
  const step = Math.round(0.42 * rate);
  const sound = Math.round(0.38 * rate);
  expect(data.getUint32(40, true) / 2).toBe(3 * step + sound);
  const sample = (i) => data.getInt16(44 + 2 * i, true);
  for (const [index, expected] of frequencies.entries()) {
    const start = index * step;
    expect(sample(start)).toBe(0);
    expect(sample(start + sound - 1)).toBe(0);
    const crossings = [];
    for (let i = start + Math.round(0.03 * rate); i < start + Math.round(0.3 * rate); i++) {
      const before = sample(i - 1);
      const after = sample(i);
      if (before <= 0 && after > 0) crossings.push(i - 1 - before / (after - before));
    }
    const pitch = ((crossings.length - 1) * rate) / (crossings.at(-1) - crossings[0]);
    expect(Math.abs(1200 * Math.log2(pitch / expected))).toBeLessThan(1);
    if (index < frequencies.length - 1) {
      const gap = new Int16Array(data.buffer, 44 + 2 * (start + sound), step - sound);
      expect(gap.every((value) => value === 0)).toBe(true);
    }
  }
});
