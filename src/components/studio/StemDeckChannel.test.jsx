/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { Profiler } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TransportProvider, createTransportStore } from '../../studio/transport/transportStore';
import { DeckMeter, SegmentMeter } from './StemDeckChannel';

const levels = (overrides) => ({ A: 0, B: 0, C: 0, D: 0, ...overrides });

describe('SegmentMeter', () => {
  it('exposes its level to assistive technology as a meter', () => {
    render(<SegmentMeter level={0.42} accent="#fff" label="A" />);
    const meter = screen.getByRole('meter', { name: 'A' });
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(meter).toHaveAttribute('aria-valuenow', '42');
    expect(meter.querySelectorAll('i.is-lit')).toHaveLength(6);
  });

  it('reports silence for an unusable level', () => {
    render(<SegmentMeter level={Number.NaN} accent="#fff" label="OUT" compact />);
    expect(screen.getByRole('meter', { name: 'OUT' })).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('DeckMeter', () => {
  it('re-renders only when its own deck level changes', () => {
    const store = createTransportStore();
    let renders = 0;
    render(
      <TransportProvider store={store}>
        <Profiler id="deck-b" onRender={() => (renders += 1)}>
          <DeckMeter deckId="B" accent="#fff" label="B" />
        </Profiler>
      </TransportProvider>
    );
    const mounted = renders;
    act(() => store.publish(levels({ A: 4 }), levels({ A: 0.9 })));
    expect(renders).toBe(mounted);
    act(() => store.publish(levels({ A: 4 }), levels({ A: 0.9, B: 0.5 })));
    expect(renders).toBe(mounted + 1);
    expect(screen.getByRole('meter', { name: 'B' })).toHaveAttribute('aria-valuenow', '50');
  });
});
