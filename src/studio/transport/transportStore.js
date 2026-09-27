import { createContext, createElement, useContext, useSyncExternalStore } from 'react';
import { DECK_IDS } from '../session/sessionModel';

const SILENT = Object.freeze(Object.fromEntries(DECK_IDS.map((id) => [id, 0])));

/**
 * Deck playheads and meter levels sampled by the transport loop. Components
 * subscribe to one value each, so a tick re-renders only what displays it and
 * never the page, the arrangement editor or the library.
 */
export function createTransportStore() {
  let positions = SILENT;
  let meters = SILENT;
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPosition: (deckId) => positions[deckId] || 0,
    getMeter: (deckId) => meters[deckId] || 0,
    // Sub-perceptual changes (10 ms, half a meter step) are not published.
    publish(nextPositions, nextMeters) {
      const moved = DECK_IDS.some(
        (id) => Math.abs((positions[id] || 0) - nextPositions[id]) > 0.01
      );
      const metered = DECK_IDS.some((id) => Math.abs((meters[id] || 0) - nextMeters[id]) > 0.005);
      if (moved) positions = nextPositions;
      if (metered) meters = nextMeters;
      if (moved || metered) emit();
    },
    setPosition(deckId, seconds) {
      positions = { ...positions, [deckId]: seconds };
      emit();
    },
    silenceMeters() {
      if (!Object.values(meters).some((value) => value !== 0)) return;
      meters = SILENT;
      emit();
    },
    reset() {
      positions = SILENT;
      meters = SILENT;
      emit();
    },
  };
}

const TransportContext = createContext(null);
const idleTransport = createTransportStore();

export function TransportProvider({ store, children }) {
  return createElement(TransportContext.Provider, { value: store }, children);
}

export function useTransport() {
  return useContext(TransportContext) || idleTransport;
}

// Server renders and first client renders show a stopped transport.
const stopped = () => 0;

export function useDeckPosition(deckId) {
  const store = useTransport();
  return useSyncExternalStore(store.subscribe, () => store.getPosition(deckId), stopped);
}

export function useDeckMeter(deckId) {
  const store = useTransport();
  return useSyncExternalStore(store.subscribe, () => store.getMeter(deckId), stopped);
}
