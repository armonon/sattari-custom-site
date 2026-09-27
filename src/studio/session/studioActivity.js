/**
 * Synchronous busy flags shared by the session, capture, deck and pad hooks.
 * Guards must see changes before React re-renders, so these are plain
 * mutable fields; each owning hook mirrors the ones it renders into state.
 */
export function createStudioActivity() {
  return {
    projectPending: false,
    capturePending: false,
    captureActive: false,
    // Keys of in-flight loads: `${deckId}:${laneId}`, `pad:${index}`, 'arranger'.
    loads: new Set(),
    automix: 0,
  };
}
