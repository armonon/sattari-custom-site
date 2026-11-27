/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createEmptyDecks } from '../session/sessionModel';
import { TransportProvider, createTransportStore } from '../transport/transportStore';
import { OverviewDeck } from './DeckOverview';
afterEach(cleanup);
it('routes playback, gain, stem changes and seeking to the real channel commands', () => {
  const deck = createEmptyDecks()[0];
  deck.duration = 30;
  deck.title = 'Test track';
  deck.lanes.vocals.status = 'ready';
  const handlers = {
      onTogglePlay: vi.fn(),
      onDeckChange: vi.fn(),
      onLaneChange: vi.fn(),
      onSeek: vi.fn(),
      onLoadLane: vi.fn(),
    },
    onDetails = vi.fn();
  render(
    <TransportProvider store={createTransportStore()}>
      <OverviewDeck deck={deck} handlers={handlers} onDetails={onDetails} />
    </TransportProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play Deck A' }));
  expect(handlers.onTogglePlay).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByRole('slider', { name: 'Deck A level' }), {
    target: { value: '65' },
  });
  expect(handlers.onDeckChange).toHaveBeenCalledWith({ gain: 65 });
  fireEvent.change(screen.getByRole('slider', { name: 'Deck A Vocals level' }), {
    target: { value: '42' },
  });
  expect(handlers.onLaneChange).toHaveBeenCalledWith('vocals', { level: 42 });
  fireEvent.click(screen.getByRole('button', { name: 'Mute Deck A Vocals' }));
  expect(handlers.onLaneChange).toHaveBeenCalledWith('vocals', { muted: true });
  fireEvent.keyDown(screen.getByRole('button', { name: 'Seek Deck A' }), { key: 'ArrowRight' });
  expect(handlers.onSeek).toHaveBeenCalledWith(5);
  expect(screen.getByRole('slider', { name: 'Deck A Drums level' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Open Deck A controls' }));
  expect(onDetails).toHaveBeenCalledOnce();
});
it('does not imply missing stems are playable, and imports into the chosen lane', () => {
  const deck = createEmptyDecks()[0],
    handlers = { onLoadLane: vi.fn() };
  render(
    <TransportProvider store={createTransportStore()}>
      <OverviewDeck deck={deck} handlers={handlers} onDetails={() => {}} />
    </TransportProvider>
  );
  expect(screen.getByRole('button', { name: 'Play Deck A' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Drums', exact: true }));
  const file = new File(['audio'], 'drums.wav', { type: 'audio/wav' });
  fireEvent.change(screen.getByLabelText('Load Deck A audio'), { target: { files: [file] } });
  expect(handlers.onLoadLane).toHaveBeenCalledWith('drums', file);
});
