// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
function processor() {
  let Type;
  const sent = [];
  runInNewContext(readFileSync(new URL('./pcmCapture.worklet.js', import.meta.url), 'utf8'), {
    sampleRate: 48000,
    Float32Array,
    AudioWorkletProcessor: class {
      port = { postMessage: (data) => sent.push(data) };
    },
    registerProcessor: (name, type) => {
      expect(name).toBe('loop-pcm-capture');
      Type = type;
    },
  });
  return { instance: new Type(), sent };
}
it('records exactly the bounded duration without sending microphone audio to speakers', () => {
  const { instance, sent } = processor();
  instance.port.onmessage({ data: { type: 'record', id: 'take1', seconds: 2.5 } });
  let offset = 0;
  while (offset < 120000) {
    const block = Float32Array.from({ length: 128 }, (_, i) => Math.sin((offset + i) / 100));
    const output = new Float32Array(128).fill(0.9);
    instance.process([[block]], [[output]]);
    expect(output.every((v) => v === 0)).toBe(true);
    offset += 128;
  }
  const take = sent.find((m) => m.type === 'complete');
  expect(take).toMatchObject({ id: 'take1', rate: 48000, inputFrames: 120000 });
  expect(take.samples).toHaveLength(120000);
  expect(take.samples[119999]).toBeCloseTo(Math.sin(119999 / 100));
  expect(sent.filter((m) => m.type === 'complete')).toHaveLength(1);
});
it('cancels without returning a take and tracks missing input explicitly', () => {
  const { instance, sent } = processor();
  instance.port.onmessage({ data: { type: 'record', id: 1, seconds: 0.5 } });
  instance.port.onmessage({ data: { type: 'cancel' } });
  for (let i = 0; i < 190; i++) instance.process([], [[new Float32Array(128)]]);
  expect(sent).toEqual([]);
  instance.port.onmessage({ data: { type: 'record', id: 2, seconds: 0.5 } });
  for (let i = 0; i < 190; i++) instance.process([], [[new Float32Array(128)]]);
  expect(sent.at(-1)).toMatchObject({ type: 'complete', inputFrames: 0, id: 2 });
});
