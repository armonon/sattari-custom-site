/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import process from 'node:process';
import { it, expect } from 'vitest';

function worklet(acknowledge = true) {
  let Processor,
    chunks = 0,
    frames = 0,
    error;
  const scope = {
    sampleRate: 8000,
    currentFrame: 0,
    Float32Array,
    AudioWorkletProcessor: class {
      constructor() {
        this.port = {
          postMessage: (data) => {
            if (data.channels) {
              expect(data.start).toBe(frames);
              frames += data.length;
              chunks++;
              expect(data.channels[0][0][0]).toBe(0.125);
              expect(data.channels[1][1].at(-1)).toBe(-0.25);
              if (acknowledge)
                this.port.onmessage({ data: { ack: true, channels: data.channels } });
            }
            if (data.error) error = data.error;
          },
        };
      }
    },
    registerProcessor: (_, value) => {
      Processor = value;
    },
  };
  vm.runInNewContext(
    readFileSync(`${process.cwd()}/src/utils/sourceCapture.worklet.js`, 'utf8'),
    scope
  );
  const processor = new Processor({ processorOptions: { count: 2, startFrame: 0 } });
  const a = new Float32Array(128).fill(0.125),
    b = new Float32Array(128).fill(-0.25);
  return {
    processor,
    scope,
    block: () =>
      processor.process(
        [
          [a, a],
          [b, b],
        ],
        [[a]]
      ),
    stats: () => ({ chunks, frames, error }),
  };
}
it('simulates two hours of two-source capture without frame drift or retained chunk growth', () => {
  const test = worklet(),
    total = 2 * 3600 * 8000;
  for (let at = 0; at < total; at += 128) {
    test.scope.currentFrame = at;
    if (!test.block()) throw Error('Capture stopped prematurely');
  }
  test.processor.port.onmessage({ data: 'stop' });
  expect(test.stats()).toEqual({ chunks: 1440, frames: total, error: undefined });
  expect(test.processor.inflight).toBe(0);
  expect(test.processor.data[0][0].length).toBe(40000);
}, 30000);
it('stops boundedly instead of accumulating audio when storage never acknowledges', () => {
  const test = worklet(false);
  for (let at = 0; at < 20 * 8000; at += 128) {
    test.scope.currentFrame = at;
    if (!test.block()) break;
  }
  expect(test.stats().chunks).toBe(2);
  expect(test.stats().error).toMatch(/storage stopped acknowledging/);
  expect(test.processor.running).toBe(false);
});
