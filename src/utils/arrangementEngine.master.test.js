import { expect, it, vi } from 'vitest';

vi.mock('tone', () => {
  const param = (value) => ({
    value,
    rampTo: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  class Node {
    constructor(options = {}) {
      this.input = this;
      this.output = this;
      for (const key of ['gain', 'frequency', 'width', 'low', 'mid', 'high'])
        this[key] = param(options[key]);
      this.lowFrequency = param(options.lowFrequency);
      this.highFrequency = param(options.highFrequency);
      this.threshold = param(options.threshold);
    }
    connect(node) {
      return node;
    }
    chain() {
      return this;
    }
    dispose() {}
    now() {
      return 7;
    }
  }
  class Compressor extends Node {
    constructor(options) {
      super(options);
      for (const key of ['threshold', 'ratio', 'attack', 'release']) {
        const target = param(options[key]);
        Object.defineProperty(target, 'value', {
          get: () => options[key],
          set() {
            throw new Error('`.value =` steps the parameter and cancels its automation.');
          },
        });
        this[key] = target;
      }
    }
  }
  return {
    Gain: Node,
    Filter: Node,
    EQ3: Node,
    StereoWidener: Node,
    Limiter: Node,
    Compressor,
    connect: vi.fn(),
  };
});

import { Compressor } from 'tone';
import { ArrangementEngine } from './arrangementEngine';

function rawContext() {
  const node = () => ({
    gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
    connect: vi.fn((next) => next),
    disconnect: vi.fn(),
  });
  return { currentTime: 7, createGain: node };
}

it('glides arranger master-assist changes and never clobbers compressor automation', () => {
  const engine = new ArrangementEngine({ rawContext: rawContext() }, {});
  const master = engine.playbackMaster({ compression: false });
  const compressor = master.nodes.find((node) => node instanceof Compressor);
  const keys = ['threshold', 'ratio', 'attack', 'release'];
  master.update({ compression: false }); // e.g. every keyboard note re-sends settings
  for (const key of keys) expect(compressor[key].setTargetAtTime).not.toHaveBeenCalled();
  master.update({ compression: true, mode: 'Club -9' });
  expect(compressor.threshold.setTargetAtTime).toHaveBeenCalledExactlyOnceWith(-12, 7, 0.012);
  expect(compressor.ratio.setTargetAtTime).toHaveBeenCalledExactlyOnceWith(3.4, 7, 0.012);
  expect(compressor.attack.setTargetAtTime).toHaveBeenCalledExactlyOnceWith(0.006, 7, 0.012);
  expect(compressor.release.setTargetAtTime).toHaveBeenCalledExactlyOnceWith(0.14, 7, 0.012);
  master.update({ compression: true, mode: 'Club -9' });
  master.update({ compression: false });
  expect(compressor.ratio.setTargetAtTime).toHaveBeenLastCalledWith(1, 7, 0.012);
  expect(compressor.ratio.setTargetAtTime).toHaveBeenCalledTimes(2);
  for (const key of keys) {
    expect(compressor[key].cancelScheduledValues).not.toHaveBeenCalled();
    expect(compressor[key].setValueAtTime).not.toHaveBeenCalled();
  }
});
