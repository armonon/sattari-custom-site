import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import InputStrip from './InputStrip';
it('keeps arm and monitoring separate and exposes channel selection and effects', () => {
  let state = {
    status: 'connected',
    monitor: false,
    armed: false,
    channel: -1,
    channelCount: 8,
    gainDb: 0,
    highpass: 80,
    peak: 0,
    lowLatency: false,
  };
  const engine = {
    getInputState: () => state,
    setInputSettings: vi.fn((patch) => {
      state = { ...state, ...patch };
    }),
  };
  render(<InputStrip getEngine={() => engine} onChoose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Record arm/ }));
  expect(engine.setInputSettings).toHaveBeenLastCalledWith({ armed: true });
  expect(screen.getByRole('button', { name: 'Monitor off' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  fireEvent.change(screen.getByLabelText('Input channel'), { target: { value: '7' } });
  expect(engine.setInputSettings).toHaveBeenLastCalledWith({ channel: 7 });
  fireEvent.click(screen.getByRole('button', { name: 'Low latency' }));
  fireEvent.click(screen.getByText('Setup & FX'));
  expect(screen.getByRole('button', { name: 'Compressor' })).toBeDisabled();
  expect(screen.getByLabelText('Input low cut')).toBeDisabled();
});

it('wires hardware gain and source selection, with setup closed by default', () => {
  let state = { status: 'connected', gainDb: 0, highpass: 80, channel: -1, peak: 0.5 };
  const onChoose = vi.fn();
  const engine = {
    getInputState: () => state,
    setInputSettings: vi.fn((patch) => {
      state = { ...state, ...patch };
    }),
  };
  render(<InputStrip getEngine={() => engine} onChoose={onChoose} />);
  expect(screen.getByText('Setup & FX').closest('details')).not.toHaveAttribute('open');
  expect(Number(screen.getByLabelText('Input peak').value)).toBeCloseTo(-6.0206);
  fireEvent.change(screen.getByRole('slider', { name: 'Input gain' }), { target: { value: '6' } });
  expect(engine.setInputSettings).toHaveBeenLastCalledWith({ gainDb: 6 });
  fireEvent.click(screen.getByRole('button', { name: 'Choose device' }));
  expect(onChoose).toHaveBeenCalledTimes(1);
  engine.setInputSettings.mockClear();
  fireEvent.click(screen.getByText('Setup & FX'));
  fireEvent.click(screen.getByText('Setup & FX'));
  expect(engine.setInputSettings).not.toHaveBeenCalled();
});

it('keeps clipping, interruption and armed status in the surviving summary', () => {
  const state = {
    status: 'interrupted',
    gainDb: 0,
    highpass: 80,
    channel: -1,
    peak: 1,
    clipping: true,
    armed: true,
    monitor: true,
  };
  render(<InputStrip getEngine={() => ({ getInputState: () => state })} onChoose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Collapse Input' }));
  const root = screen.getByRole('region', { name: 'Live input strip' });
  expect(root).toHaveAttribute('data-panel-collapsed', 'true');
  for (const text of ['CLIPPING', 'Interrupted', 'Armed']) {
    const summary = screen.getByText(text).closest('.sd-panel-collapse-bar');
    expect(summary).toHaveAttribute('data-panel-summary');
    expect(summary.parentElement).toBe(root);
  }
});
