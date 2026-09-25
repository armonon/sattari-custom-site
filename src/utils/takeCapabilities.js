// Capability labels describe stored data, not an unearned audio-parity guarantee.
// Full Editable is deliberately reserved until source/replay qualification exists.
export function takeCapabilities(capture) {
  const events = (capture.events || []).filter((event) => !event.disabled);
  const initial = events.find((event) => event.type === 'initialState')?.args?.[0];
  const actions = events.filter((event) => event.type !== 'initialState');
  const types = new Set(actions.map((event) => event.type));
  const editable = [];
  if (initial?.decks?.length) editable.push('Decks');
  if ([...types].some((type) => /Gain|Fader|Crossfader|Level|Eq|MasterStems/.test(type)))
    editable.push('Mixer');
  if ([...types].some((type) => /Fx|Filter|Processing|Assist|Limiter/.test(type)))
    editable.push('FX');
  if (types.has('setLoop') || types.has('setLoopRegion')) editable.push('Loops');
  if (types.has('inputState'))
    editable.push(initial?.inputCaptureVersion === 1 ? 'Input processing' : 'Input history');
  const limits = [];
  if (initial)
    limits.push(
      'Pitch, loop, source and some effect changes still use measured real-time dispatch; exact replay is not certified.'
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
    editable,
    safety: !!(capture.assetId || capture.sourceCaptureId),
    limits,
  };
}
