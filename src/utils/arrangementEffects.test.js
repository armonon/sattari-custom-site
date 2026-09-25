import { expect, it, vi } from 'vitest';
import {
  EFFECTS,
  newEffect,
  validateEffects,
  rackTail,
  diskPluginInventory,
  createMutableEffectRack,
} from './arrangementEffects';
import {
  audioTrack,
  audioClip,
  emptyArrangement,
  arrangementDuration,
  validateArrangement,
  migrateArrangement,
} from './arrangementModel';

function rackContext() {
  const nodes = [];
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  const node = () => {
    const result = {
      gain: param(),
      frequency: param(),
      Q: param(),
      connect: vi.fn(function (target) {
        return target;
      }),
      disconnect: vi.fn(),
    };
    nodes.push(result);
    return result;
  };
  return { currentTime: 1, state: 'running', nodes, createGain: node, createBiquadFilter: node };
}
it('crossfades rapid rack replacements from the actual audio-clock gain with stable mix endpoints', () => {
  vi.useFakeTimers();
  const raw = rackContext(),
    rack = createMutableEffectRack(raw),
    mix = rack.output;
  const oldOutput = raw.nodes[3];
  rack.update([newEffect('eq')]);
  const replacementOutput = raw.nodes[5];
  raw.currentTime = 1.0125;
  rack.update([]);
  expect(oldOutput.disconnect).not.toHaveBeenCalled();
  expect(oldOutput.gain.setValueAtTime).toHaveBeenLastCalledWith(expect.closeTo(0.5), 1.0125);
  expect(replacementOutput.gain.setValueAtTime).toHaveBeenLastCalledWith(
    expect.closeTo(0.5),
    1.0125
  );
  expect(mix.gain.cancelScheduledValues).not.toHaveBeenCalled();
  expect(mix).toBe(rack.output);
  raw.state = 'suspended';
  vi.advanceTimersByTime(1000);
  expect(oldOutput.disconnect).not.toHaveBeenCalled();
  raw.currentTime = 1.05;
  raw.state = 'running';
  vi.advanceTimersByTime(100);
  expect(oldOutput.disconnect).toHaveBeenCalledOnce();
  rack.dispose();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
it('keeps the active graph intact after invalid or over-budget replacements and cleans up on close', () => {
  vi.useFakeTimers();
  const raw = rackContext(),
    rack = createMutableEffectRack(raw);
  expect(() => rack.update([{ type: 'native' }])).toThrow();
  expect(rack.topology).toBe('[]');
  for (let i = 0; i < 16; i++) rack.update([newEffect('eq')]);
  const topology = rack.topology;
  expect(() => rack.update([])).toThrow(/still changing/);
  expect(rack.topology).toBe(topology);
  expect(() => rack.schedule([])).toThrow(/preserve/);
  raw.state = 'closed';
  vi.advanceTimersByTime(100);
  rack.dispose();
  rack.dispose();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
it('validates bounded browser effects and rejects executable/unknown definitions', () => {
  for (const type of Object.keys(EFFECTS))
    expect(validateEffects([newEffect(type)])).toHaveLength(1);
  expect(() =>
    validateEffects([{ id: 'x', type: 'file:///plugin.vst3', params: {}, bypass: false }])
  ).toThrow(/Unsupported/);
  const fx = newEffect('echo');
  fx.params.feedback = 2;
  expect(() => validateEffects([fx])).toThrow(/parameter/);
  expect(() => validateEffects(Array.from({ length: 9 }, () => newEffect('eq')))).toThrow(/eight/);
  const eq = newEffect('eq');
  expect(() => validateEffects([eq, eq])).toThrow(/damaged/);
});
it('preserves rack state through project validation, serialization and migration', () => {
  const project = emptyArrangement(),
    track = audioTrack('Keys');
  track.clips = [audioClip('asset', 'Tone', 1)];
  track.effects = [newEffect('eq'), newEffect('echo')];
  project.tracks.push(track);
  expect(validateArrangement(project)).toBe(project);
  const restored = migrateArrangement({ arranger: JSON.parse(JSON.stringify(project)) });
  expect(restored.tracks[0].effects).toEqual(track.effects);
  expect(arrangementDuration(project)).toBe(1 + rackTail(track.effects));
  track.effects[1].bypass = true;
  expect(arrangementDuration(project)).toBe(1);
});
it('validates device automation and budgets tails for its maximum feedback and delay', () => {
  const track = { ...audioTrack(), effects: [newEffect('echo')], clips: [audioClip('a', 'a', 1)] };
  const effect = track.effects[0];
  track.automation = {
    [`fx:${effect.id}:feedback`]: [{ time: 0, value: 0.5 }],
    [`fx:${effect.id}:time`]: [{ time: 0, value: 0.6 }],
  };
  const project = { ...emptyArrangement(), tracks: [track] };
  expect(() => validateArrangement(project)).not.toThrow();
  expect(arrangementDuration(project)).toBeGreaterThan(1 + rackTail(track.effects));
  track.automation[`fx:${effect.id}:feedback`][0].value = 1;
  expect(() => validateArrangement(project)).toThrow();
});
it('inventories bundle names without reading, executing or duplicating their binaries', () => {
  const files = [
    { webkitRelativePath: 'Plugins/Keys.vst3/Contents/Info.plist' },
    { webkitRelativePath: 'Plugins/Keys.vst3/Contents/MacOS/Keys' },
    { webkitRelativePath: 'Plugins/EQ.component/Contents/Info.plist' },
    { name: 'Synth.clap' },
    { name: 'random.js' },
  ];
  expect(diskPluginInventory(files).map(({ name, format }) => ({ name, format }))).toEqual([
    { name: 'Keys', format: 'VST3' },
    { name: 'EQ', format: 'AU' },
    { name: 'Synth', format: 'CLAP' },
  ]);
});
