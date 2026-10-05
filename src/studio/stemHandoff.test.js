import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { hasStemHandoff, offerStemHandoff, takeStemHandoff } from './stemHandoff';
import { useStemHandoff } from './hooks/useStemHandoff';

const file = (name) => new File(['x'], name, { type: 'audio/wav' });
const freeDeck = (id) => ({ id, duration: 0, lanes: { fullMix: { status: 'empty' } } });
const busyDeck = (id) => ({
  id,
  duration: 90,
  lanes: { fullMix: { status: 'ready', duration: 90 } },
});

describe('Split → StemDeck handoff', () => {
  it('maps Demucs sources to StemDeck lanes and is taken once', () => {
    offerStemHandoff({
      title: 'Song',
      fullMix: file('song.mp3'),
      stems: ['vocals', 'drums', 'bass', 'other', 'unknown'].map((id) => ({
        id,
        file: file(`${id}.wav`),
      })),
    });
    expect(hasStemHandoff()).toBe(true);
    const handoff = takeStemHandoff();
    expect(handoff.stems.map((stem) => stem.laneId)).toEqual(['vocals', 'drums', 'bass', 'music']);
    expect(takeStemHandoff()).toBeNull();
  });

  it('loads the mix and stems into the first free deck once the session is ready', async () => {
    const mix = file('song.mp3');
    offerStemHandoff({
      title: 'Song',
      fullMix: mix,
      stems: [
        { id: 'vocals', file: file('v.wav') },
        { id: 'other', file: file('o.wav') },
      ],
    });
    const deckOps = { loadLane: vi.fn().mockResolvedValue(true), changeLane: vi.fn() };
    const actions = { setFocusedDeckId: vi.fn() };
    const setNotice = vi.fn();
    const setActiveView = vi.fn();
    const props = {
      ready: false,
      decks: [busyDeck('A'), freeDeck('B')],
      deckOps,
      actions,
      setActiveView,
      setNotice,
    };
    const { rerender } = renderHook((current) => useStemHandoff(current), { initialProps: props });
    expect(deckOps.loadLane).not.toHaveBeenCalled();
    rerender({ ...props, ready: true });
    await waitFor(() => expect(deckOps.changeLane).toHaveBeenCalled());
    expect(deckOps.loadLane.mock.calls.map(([deck, lane]) => `${deck}:${lane}`)).toEqual([
      'B:fullMix',
      'B:vocals',
      'B:music',
    ]);
    expect(deckOps.loadLane.mock.calls[0][2]).toBe(mix);
    expect(deckOps.changeLane).toHaveBeenCalledWith('B', 'fullMix', { level: 0 });
    expect(actions.setFocusedDeckId).toHaveBeenCalledWith('B');
    expect(setActiveView).toHaveBeenCalledWith('decks');
    expect(setNotice).toHaveBeenLastCalledWith(
      expect.stringMatching(/2 Split stems are ready in Deck B/)
    );
    expect(hasStemHandoff()).toBe(false);
  });

  it('never replaces a loaded deck', () => {
    offerStemHandoff({ title: 'Song', fullMix: file('s.mp3'), stems: [] });
    const deckOps = { loadLane: vi.fn(), changeLane: vi.fn() };
    const setNotice = vi.fn();
    renderHook(() =>
      useStemHandoff({
        ready: true,
        decks: ['A', 'B', 'C', 'D'].map(busyDeck),
        deckOps,
        actions: { setFocusedDeckId: vi.fn() },
        setActiveView: vi.fn(),
        setNotice,
      })
    );
    expect(deckOps.loadLane).not.toHaveBeenCalled();
    expect(setNotice).toHaveBeenCalledWith(expect.stringMatching(/All four decks are in use/));
  });
});
