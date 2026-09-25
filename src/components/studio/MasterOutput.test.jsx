import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import MasterOutput from './MasterOutput';
import { DEFAULT_MASTER_PROCESSING } from '../../utils/masterOutput';
import { EFFECT_DRAG_TYPE } from '../../utils/arrangementEffects';
const engine = {
  setMasterMonitor: vi.fn(),
  resetLoudness: vi.fn(),
  getMasterStatus: () => ({
    left: -96,
    right: -96,
    peak: -96,
    rms: -96,
    reduction: 0,
    correlation: null,
    sampleRate: 48000,
    state: 'running',
  }),
  getMasterStemSources: () => ({ vocals: 2 }),
};
const getEngine = () => engine;
const onLimiter = vi.fn();
const onLevel = vi.fn();
const onCompression = vi.fn();
let saved;
function Host({ visible = true, captureActive = false, compact = false }) {
  const [settings, setSettings] = useState(DEFAULT_MASTER_PROCESSING);
  saved = settings;
  return (
    <MasterOutput
      compact={compact}
      visible={visible}
      captureActive={captureActive}
      getEngine={getEngine}
      settings={settings}
      onSettings={setSettings}
      level={100}
      onLevel={onLevel}
      limiter
      onLimiter={onLimiter}
      compression={false}
      onCompression={onCompression}
    />
  );
}
it('keeps meters and speaker controls in the surviving master summary when collapsed', () => {
  render(<Host />);
  const root = screen.getByRole('region', { name: 'Master output status' });
  const settings = saved;
  fireEvent.click(screen.getByRole('button', { name: 'Collapse Master output' }));
  expect(root).toHaveAttribute('data-panel-collapsed', 'true');
  const summary = screen.getByRole('button', { name: 'Expand Master output' }).closest('header');
  expect(summary).toHaveAttribute('data-panel-summary');
  expect(within(summary).getByLabelText('left sample peak')).toBeInTheDocument();
  expect(within(summary).getByRole('button', { name: 'Mute speakers' })).toBeInTheDocument();
  expect(saved).toBe(settings);
  fireEvent.click(screen.getByRole('button', { name: 'Expand Master output' }));
  expect(root).toHaveAttribute('data-panel-collapsed', 'false');
});
it('exposes independent master stem gain, mute, solo and reset without resetting master tone', () => {
  render(<Host />);
  expect(screen.getByRole('region', { name: 'Master stem mixer' })).toBeVisible();
  fireEvent.change(screen.getByRole('slider', { name: 'Master vocals level' }), {
    target: { value: '200' },
  });
  expect(saved.stems.vocals.level).toBe(200);
  fireEvent.click(screen.getByRole('button', { name: 'Solo master vocals' }));
  expect(saved.stems.vocals.solo).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Mute master bass' }));
  expect(saved.stems.bass.muted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Reset stem mix' }));
  expect(saved.stems.vocals).toEqual({ level: 100, solo: false, muted: false });
  expect(saved.ceiling).toBe(-1);
});
it('wires trims, crossover and delivery controls, and recalls A/B without reverting routing', () => {
  const { rerender } = render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'Open master' }));
  fireEvent.click(screen.getByText('EQ crossovers', { selector: 'summary' }));
  fireEvent.click(screen.getByText('Tone & dynamics A/B', { selector: 'summary' }));
  for (const [name, value] of [
    ['Input trim', '-4'],
    ['Pre-limiter trim', '2'],
    ['Low crossover', '400'],
    ['High crossover', '5000'],
  ]) {
    fireEvent.change(screen.getByRole('slider', { name }), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Store A' }));
  fireEvent.change(screen.getByRole('slider', { name: 'Input trim' }), { target: { value: '5' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Loudness target' }), {
    target: { value: '-18' },
  });
  fireEvent.change(screen.getByRole('slider', { name: 'True-peak target' }), {
    target: { value: '-2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Mute master bass' }));
  fireEvent.drop(screen.getByRole('region', { name: 'Master output status' }), {
    dataTransfer: { files: [], getData: () => '["echo"]' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Recall A' }));
  expect(saved).toMatchObject({
    inputTrim: -4,
    limiterDrive: 2,
    lowFrequency: 400,
    highFrequency: 5000,
    targetLufs: -18,
    targetPeak: -2,
    stems: { bass: { muted: true } },
  });
  expect(saved.effects[0].type).toBe('echo');
  expect(onLevel).toHaveBeenLastCalledWith(100);
  expect(onLimiter).toHaveBeenLastCalledWith(true);
  expect(onCompression).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole('button', { name: 'Recall B' })).toBeDisabled();
  rerender(<Host captureActive />);
  expect(screen.getByRole('button', { name: 'Recall A' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Replace A' })).toBeDisabled();
});
it('hides the output controls without resetting the stem mix', () => {
  const { rerender } = render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'Mute master bass' }));
  rerender(<Host visible={false} />);
  expect(screen.queryByRole('region', { name: 'Master output status' })).not.toBeInTheDocument();
  expect(saved.stems.bass.muted).toBe(true);
  rerender(<Host />);
  expect(screen.getByRole('button', { name: 'Mute master bass' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});
it('distinguishes saved gain, mute and solo exclusion in the redesigned stem cards', () => {
  render(<Host />);
  const vocals = within(screen.getByRole('region', { name: 'Vocals master stem' }));
  const bass = within(screen.getByRole('region', { name: 'Bass master stem' }));
  fireEvent.change(vocals.getByRole('slider', { name: 'Master vocals level' }), {
    target: { value: '180' },
  });
  expect(vocals.getByLabelText('Vocals gain')).toHaveTextContent('180%');
  expect(vocals.getByText('Boost')).toBeVisible();
  fireEvent.click(vocals.getByRole('button', { name: 'Solo master vocals' }));
  expect(vocals.getByText('Solo', { selector: '.sd-master-stem-state' })).toBeVisible();
  expect(bass.getByText('Excluded')).toBeVisible();
  fireEvent.click(vocals.getByRole('button', { name: 'Mute master vocals' }));
  expect(vocals.getByText('Muted')).toBeVisible();
  expect(vocals.getByLabelText('Vocals gain')).toHaveTextContent('180%');
  fireEvent.click(vocals.getByRole('button', { name: 'Reset master vocals level' }));
  expect(saved.stems.vocals).toEqual({ level: 100, solo: true, muted: true });
  expect(vocals.getByLabelText('Vocals gain')).toHaveTextContent('100%');
});
it('accepts copied browser effects on the master, edits them and rejects native binaries', () => {
  render(<Host />);
  const master = screen.getByRole('region', { name: 'Master output status' });
  fireEvent.drop(master, {
    dataTransfer: { files: [], getData: (type) => (type === EFFECT_DRAG_TYPE ? '["echo"]' : '') },
  });
  expect(saved.effects[0].type).toBe('echo');
  expect(screen.getByRole('region', { name: 'Master insert effects' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Sattari Echo 1 Mix'), { target: { value: '0.5' } });
  expect(saved.effects[0].params.mix).toBe(0.5);
  fireEvent.click(screen.getByLabelText('Bypass Sattari Echo 1'));
  expect(saved.effects[0].bypass).toBe(true);
  fireEvent.drop(master, {
    dataTransfer: { files: [new File([''], 'Native.vst3')], getData: () => '' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent('desktop host');
  expect(saved.effects).toHaveLength(1);
  fireEvent.click(screen.getByLabelText('Remove effect 1'));
  expect(saved.effects).toHaveLength(0);
});
it('rejects unknown and over-capacity drops without changing the rack', () => {
  render(<Host />);
  const master = screen.getByRole('region', { name: 'Master output status' });
  const drop = (types) =>
    fireEvent.drop(master, { dataTransfer: { files: [], getData: () => JSON.stringify(types) } });
  drop(['not-a-plugin']);
  expect(saved.effects).toBeUndefined();
  drop(Array(8).fill('eq'));
  expect(saved.effects).toHaveLength(8);
  drop(['echo']);
  expect(saved.effects).toHaveLength(8);
  expect(screen.getByRole('alert')).toHaveTextContent('eight');
});
it('shows measured loudness and prevents integration reset during capture', () => {
  const status = vi.spyOn(engine, 'getMasterStatus').mockReturnValue({
    left: -12,
    right: -12,
    peak: -12,
    rms: -20,
    reduction: 0,
    correlation: 1,
    state: 'running',
    loudness: {
      available: true,
      integrated: -14.1,
      momentary: -13,
      shortTerm: -14,
      truePeak: -1.2,
    },
  });
  try {
    const { rerender } = render(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Open master' }));
    expect(
      within(screen.getByRole('region', { name: 'Master dynamics' })).getByText('-14.1')
    ).toBeVisible();
    expect(screen.getByText('-1.2 dBTP')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reset loudness' }));
    expect(engine.resetLoudness).toHaveBeenCalledTimes(1);
    rerender(<Host captureActive />);
    expect(screen.getByRole('button', { name: 'Reset loudness' })).toBeDisabled();
  } finally {
    status.mockRestore();
  }
});
it('keeps icon-led quick controls named and wired in the compact console', () => {
  render(<Host compact />);
  const quick = within(screen.getByRole('group', { name: 'Master quick controls' }));
  fireEvent.click(quick.getByRole('button', { name: 'Toggle master limiter' }));
  expect(onLimiter).toHaveBeenCalledWith(false);
  fireEvent.click(quick.getByRole('button', { name: 'Mute speakers' }));
  expect(engine.setMasterMonitor).toHaveBeenLastCalledWith({
    mono: false,
    dimmed: false,
    muted: true,
  });
  expect(quick.getByRole('button', { name: 'Unmute speakers' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(quick.getByRole('button', { name: 'Master FX · 0 / 8' }));
  expect(screen.getByRole('region', { name: 'Master insert effects' })).toBeVisible();
  expect(quick.getByRole('button', { name: 'Close master' })).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  fireEvent.click(quick.getByRole('button', { name: 'Close master' }));
  expect(screen.queryByRole('region', { name: 'Master insert effects' })).not.toBeInTheDocument();
  expect(quick.getByRole('button', { name: 'Open master' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
});
