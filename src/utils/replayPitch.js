// Compile independent future musical state. Reading the public deck while
// queueing future edits would combine tomorrow's rate with today's pitch.
export const PITCH_EVENTS = new Set(['setDeckPitch', 'setDeckKeyLock', 'setStemPitch']);
const clamp = (value, min, max, fallback = 0) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));

export function pitchAutomation(initial) {
  const decks = new Map(
    (initial.decks || []).map((deck) => [
      deck.id,
      {
        rate: clamp(deck.playbackRate, 0.5, 2, 1),
        pitch: clamp(deck.pitch, -12, 12),
        keyLock: deck.keyLock !== false,
        stems: Object.fromEntries(
          Object.entries(deck.lanes || {}).map(([id, lane]) => [id, clamp(lane.pitch, -12, 12)])
        ),
      },
    ])
  );
  return (event) => {
    const [id, value, pitch] = event.args;
    const state = decks.get(id);
    if (!state) return null;
    if (event.type === 'deckTransport') state.rate = clamp(value.rate, 0.5, 2, state.rate);
    if (event.type === 'setDeckPitch') state.pitch = clamp(value, -12, 12);
    if (event.type === 'setDeckKeyLock') state.keyLock = !!value;
    if (event.type === 'setStemPitch' && Object.hasOwn(state.stems, value))
      state.stems[value] = clamp(pitch, -12, 12);
    const ratePitch = state.keyLock ? 0 : 12 * Math.log2(state.rate);
    return {
      ...state,
      stems: { ...state.stems },
      detunes: Object.fromEntries(
        Object.entries(state.stems).map(([lane, cents]) => [
          lane,
          (state.pitch + cents + ratePitch) * 100,
        ])
      ),
    };
  };
}
