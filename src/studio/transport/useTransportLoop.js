import { useEffect } from 'react';

/**
 * Samples deck positions and meters at most every 50 ms while anything is
 * audible and publishes them to the transport store. The loop restarts only
 * when activity starts or stops; it reads the latest decks through `latest`,
 * so knob moves neither tear it down nor reset its throttle.
 */
export function useTransportLoop({ active, store, engineRef, latest, updateDeck, setNotice }) {
  useEffect(() => {
    if (!active) {
      store.silenceMeters();
      return undefined;
    }
    let lastUpdate = 0;
    let frame = 0;
    const tick = (timestamp) => {
      const engine = engineRef.current;
      if (engine && timestamp - lastUpdate >= 50) {
        const positions = {};
        const meters = {};
        latest.current.decks.forEach((deck) => {
          const status = engine.getDeckTransportStatus?.(deck.id);
          if (status?.error) {
            setNotice(`Deck ${deck.id}: ${status.error}`);
            if (deck.playing && !status.playing) updateDeck(deck.id, { playing: false });
          }
          const position = engine.getDeckPosition(deck.id);
          positions[deck.id] = position;
          meters[deck.id] = engine.getDeckMeterLevel(deck.id);
          if (deck.playing && !deck.looping && deck.duration && position >= deck.duration) {
            engine.stopDeck(deck.id);
            updateDeck(deck.id, { playing: false });
          }
        });
        store.publish(positions, meters);
        lastUpdate = timestamp;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, store, engineRef, latest, updateDeck, setNotice]);
}
