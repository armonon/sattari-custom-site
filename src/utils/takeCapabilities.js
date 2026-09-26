// Capability labels describe stored data, not an unearned audio-parity guarantee.
// Full Editable is deliberately reserved until source/replay qualification exists.
import { performanceSupportForTake } from './performanceSupport';

export function takeCapabilities(capture) {
  const events = (capture.events || []).filter((event) => !event.disabled);
  const initial = events.find((event) => event.type === 'initialState')?.args?.[0];
  const actions = events.filter((event) => event.type !== 'initialState');
  const types = new Set(actions.map((event) => event.type));
  const support = performanceSupportForTake(capture);
  const limits = [];
  if (initial)
    limits.push(
      'Fixed-source transport and supported pitch changes can use audio-clock scheduling. Source changes and some effects still use real-time dispatch; exhaustive exact replay is not qualified.'
    );
  if (initial?.decks?.some((deck) => deck.playing))
    limits.push('Opening effect tails and grain phase may differ.');
  if (types.has('inputState'))
    limits.push(
      initial?.inputCaptureVersion === 1
        ? 'Input gain, monitor and built-in FX require the editable input lane. Device/channel choices remain printed; unarmed, unmonitored periods cannot be recovered.'
        : 'Input sound is printed; history edits do not reprocess legacy input audio.'
    );
  if (types.has('triggerPad'))
    limits.push(
      'Pads use their printed sound by default; rebuilding synthesized noise may differ.'
    );
  return {
    label: initial ? 'Performance Take' : 'Audio Take',
    actions: actions.length,
    editable: support.editable,
    printed: support.printed,
    support,
    safety: !!(capture.assetId || capture.sourceCaptureId),
    limits,
  };
}
