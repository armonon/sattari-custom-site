import { expect, it, vi } from 'vitest';
import { ReplayInput } from './replayInput';
import { replayScheduling } from './performancePlayer';

it('queues input gain, monitoring and FX against absolute audio time without graph swaps', () => {
  const param = () => ({ value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn() });
  const node = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: param(),
    frequency: param(),
    threshold: param(),
    ratio: param(),
    attack: param(),
    release: param(),
  });
  const context = { createGain: node, createBiquadFilter: node, createDynamicsCompressor: node };
  const input = new ReplayInput(context, node());
  input.schedule({ gainDb: -12, monitor: true, lowLatency: true, status: 'connected' }, 1, true);
  expect(input.input.gain.setValueAtTime).toHaveBeenCalledWith(10 ** (-12 / 20), 1);
  expect(input.paths[0].gain.setValueAtTime).toHaveBeenCalledWith(1, 1);
  input.schedule(
    { gainDb: 6, highpass: 120, compression: true, monitor: true, status: 'connected' },
    10.25
  );
  expect(input.input.gain.setTargetAtTime).toHaveBeenCalledWith(10 ** (6 / 20), 10.25, 0.005);
  expect(input.paths[2].gain.setTargetAtTime).toHaveBeenCalledWith(1, 10.25, 0.005);
  input.schedule({ monitor: false }, 11);
  for (const path of input.paths) expect(path.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 11);
  expect(input.input.disconnect).not.toHaveBeenCalled();
  const event = { type: 'inputState', time: 2, args: [{}] };
  expect(replayScheduling({ initial: { decks: [] }, events: [event] }).scheduled).toEqual([event]);
  input.dispose();
  expect(input.input.disconnect).toHaveBeenCalled();
});
