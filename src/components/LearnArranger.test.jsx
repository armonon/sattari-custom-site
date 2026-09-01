/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LearnArranger from './LearnArranger';

vi.mock('tone', () => ({
  getTransport: () => ({
    stop: vi.fn(),
    cancel: vi.fn(),
  }),
}));

describe('LearnArranger', () => {
  it('publishes chord, bass, and drum edits as a Studio-ready arrangement', async () => {
    const onArrangementChange = vi.fn();

    render(
      <LearnArranger
        bpm={96}
        initialChords={['Am7', 'Fmaj7', 'C', 'G']}
        onArrangementChange={onArrangementChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Chord for bar 1'), { target: { value: 'E7' } });
    fireEvent.change(screen.getByLabelText('Line'), { target: { value: 'octaves' } });
    fireEvent.click(screen.getByRole('button', { name: 'Disable Kick step 1' }));

    await waitFor(() => {
      const latestArrangement = onArrangementChange.mock.calls.at(-1)[0];
      expect(latestArrangement.progression[0]).toBe('E7');
      expect(latestArrangement.bassPattern).toBe('octaves');
      expect(latestArrangement.drumPattern.kick[0]).toBe(false);
      expect(latestArrangement.schema).toBe('SattariLearn.practiceArrangement.v1');
    });
  });
});
