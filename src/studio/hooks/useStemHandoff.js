import { useEffect, useRef } from 'react';
import { deckIsFree } from '../session/sessionModel';
import { hasStemHandoff, takeStemHandoff } from '../stemHandoff';

/**
 * Loads stems handed over by the Split lab into the first free deck once the
 * restored session is ready: the original mix (for BPM/key analysis) plus each
 * stem lane, with the full-mix lane turned down so the stems are what you hear.
 */
export function useStemHandoff({ ready, decks, deckOps, actions, setActiveView, setNotice }) {
  const latest = useRef({ decks, deckOps, actions, setActiveView, setNotice });
  latest.current = { decks, deckOps, actions, setActiveView, setNotice };

  useEffect(() => {
    if (!ready || !hasStemHandoff()) return;
    const handoff = takeStemHandoff();
    const {
      decks: current,
      deckOps: ops,
      actions: act,
      setActiveView: view,
      setNotice: notify,
    } = latest.current;
    const deck = current.find(deckIsFree);
    if (!deck) {
      notify(
        'All four decks are in use, so the Split stems were not loaded. Clear a deck and use Open in StemDeck again, or import the downloaded WAVs.'
      );
      return;
    }
    void (async () => {
      view('decks');
      act.setFocusedDeckId(deck.id);
      if (!(await ops.loadLane(deck.id, 'fullMix', handoff.fullMix))) return;
      let loaded = 0;
      for (const { laneId, file } of handoff.stems) {
        if (await ops.loadLane(deck.id, laneId, file)) loaded += 1;
      }
      if (loaded) ops.changeLane(deck.id, 'fullMix', { level: 0 });
      notify(
        loaded === handoff.stems.length
          ? `${handoff.title}: ${loaded} Split stems are ready in Deck ${deck.id}. The full mix is turned down; raise MIX to hear it.`
          : `${handoff.title}: ${loaded} of ${handoff.stems.length} stems loaded into Deck ${deck.id}. Import the missing WAVs from your downloads.`
      );
    })();
  }, [ready]);
}
