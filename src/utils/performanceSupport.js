// Canonical implementation inventory, NOT release certification. "Implemented"
// describes a code path; only an end-to-end qualification can establish parity.
export const PERFORMANCE_STAGES = ['capture', 'replay', 'arrange', 'reopen', 'export'];
export const SUPPORT_LABELS = {
  implemented: 'PARTIAL', // Implementation alone is not qualification.
  partial: 'PARTIAL',
  printed: 'PRINTED ONLY',
  unverified: 'UNSUPPORTED',
};

const row = (id, label, events, destination, stages, limit) =>
  Object.freeze({
    id,
    label,
    events: Object.freeze(events),
    destination,
    stages: Object.freeze(
      Object.fromEntries(PERFORMANCE_STAGES.map((key, index) => [key, stages[index]]))
    ),
    limit,
    qualified: false,
  });
const I = 'implemented',
  P = 'partial',
  R = 'printed';
export const PERFORMANCE_SUPPORT = Object.freeze([
  row(
    'transport',
    'Deck launch / stop / cue / seek',
    ['deckTransport', 'playDeck', 'pauseDeck', 'stopDeck', 'seekDeck'],
    'Source clip regions',
    [I, P, I, I, P],
    'Confirmed deckTransport uses audible time. Legacy requested times and opening DSP state are not exact.'
  ),
  row(
    'sources',
    'Source replacement / removal',
    ['setLaneState', 'removeLane'],
    'Clips referencing retained source assets',
    [I, P, P, I, P],
    'Sources must remain available. Changing sources during replay still requires real-time dispatch.'
  ),
  row(
    'loop',
    'Loop / loop length',
    ['setLoop', 'setLoopRegion'],
    'Repeated source regions and loop metadata',
    [I, P, I, I, P],
    'Tiny fragments and expansion limits require the print; live effect history across loops is not fully reconstructed.'
  ),
  row(
    'rate',
    'Tempo / playback rate',
    ['setPlaybackRate'],
    'Clip playback rate',
    [I, P, P, I, P],
    'Rate is represented, not a project tempo map. Key-locked and pitch-processed audio still needs the print.'
  ),
  row(
    'pitch',
    'Deck / stem pitch and key lock',
    ['setDeckPitch', 'setDeckKeyLock', 'setStemPitch'],
    'Replay event controls; printed sound in Arrange',
    [I, P, R, I, R],
    'Fixed-source replay has compiled pitch commands; no equivalent editable arrangement pitch reconstruction.'
  ),
  row(
    'mixer',
    'Deck gain / fader / crossfader',
    ['setDeckGain', 'setDeckFader', 'setDeckSide', 'setCrossfader', 'setCrossfaderCurve'],
    'Combined lane volume automation',
    [I, P, I, I, P],
    'Individual controls are folded into a single volume envelope; full live/export parity remains unqualified.'
  ),
  row(
    'stems',
    'Stem gain / mute / solo',
    ['setLaneState', 'setMasterStems'],
    'Combined lane volume automation',
    [I, P, P, I, P],
    'Stem mix is editable as volume, not independent original control lanes. Lane FX remain printed.'
  ),
  row(
    'eq',
    'Deck EQ',
    ['setDeckEq'],
    'Replay event controls; printed EQ in Arrange',
    [I, P, R, I, R],
    'Recorded EQ is not converted to arrangement devices or envelopes.'
  ),
  row(
    'filter',
    'Deck filter',
    ['setDeckFilter'],
    'Replay event controls; printed filter in Arrange',
    [I, P, R, I, R],
    'Stable filter types can schedule replay sweeps; arrangement reconstruction does not create their automation.'
  ),
  row(
    'fx',
    'Deck / stem FX parameters',
    ['setDeckFx', 'setLaneFx'],
    'Replay event controls; printed effects in Arrange',
    [I, P, R, I, R],
    'Opening tails, legacy effects and DSP graph changes are not certified exact.'
  ),
  row(
    'master',
    'Master processing / devices / output level',
    ['setMasterProcessing', 'setMasterAssist', 'setLimiter', 'setMasterLevel'],
    'Replay event controls; printed master processing',
    [I, P, R, I, R],
    'Reconstructed sources use the current master settings, not a reconstructed historical master chain.'
  ),
  row(
    'pads',
    'Pad trigger / gain',
    ['triggerPad', 'setPadGain'],
    'Printed pad recording; optional event rebuild',
    [I, P, R, I, R],
    'Rebuilt synthesized noise can differ from the captured sound.'
  ),
  row(
    'inputGain',
    'Input gain / effects',
    ['inputState'],
    'Aligned captured input; versioned processing replay',
    [I, P, P, I, P],
    'Editable processing requires version-1 input capture and its dry lane. Legacy inputs remain printed.'
  ),
  row(
    'inputMonitor',
    'Input monitoring / connection',
    ['inputState', 'openMicrophone', 'closeMicrophone'],
    'Recorded input intervals plus history',
    [I, P, P, I, P],
    'Device changes are not recreated. Unarmed, unmonitored input cannot be recovered.'
  ),
  row(
    'midi',
    'MIDI notes',
    [],
    'MIDI clips via the arrangement recorder',
    [P, P, P, I, P],
    'Separate MIDI recording path; full live-performance-to-MIDI lifecycle still needs qualification.'
  ),
  row(
    'pan',
    'Pan',
    [],
    'Authored arrangement pan envelopes; live history not reconstructed',
    ['unverified', 'unverified', I, I, P],
    'Arrangement pan is available, but no qualified captured live-pan lifecycle exists.'
  ),
  row(
    'routing',
    'Output / cue / input routing',
    [],
    'Printed sound and local device configuration',
    [P, P, R, P, R],
    'Physical device and cue topology are not reconstructed. Printed output preserves only the signal actually captured.'
  ),
  row(
    'deviceAutomation',
    'Arrangement device automation',
    [],
    'Track/device envelopes',
    [P, P, I, I, P],
    'Authored arrangement envelopes exist; this does not imply conversion of every live FX mutation.'
  ),
]);

// Shipped alongside the qualified artifact; never promote an implemented path
// to PASS from unrelated unit tests or a partial synthetic lifecycle.
export function performanceReleaseMatrix(commit) {
  return {
    schemaVersion: 1,
    commit,
    fullyQualified: false,
    states: ['PASS', 'PARTIAL', 'PRINTED ONLY', 'UNSUPPORTED'],
    rows: PERFORMANCE_SUPPORT.map((item) => ({
      id: item.id,
      action: item.label,
      destination: item.destination,
      stages: Object.fromEntries(
        PERFORMANCE_STAGES.map((stage) => [stage, SUPPORT_LABELS[item.stages[stage]]])
      ),
      limitations: item.limit,
      stageEvidence: Object.fromEntries(PERFORMANCE_STAGES.map((stage) => [stage, []])),
    })),
  };
}

// Exact handler inventory shared by the reconstructor and its coverage tests.
export const RECONSTRUCTION_EVENTS = Object.freeze([
  'initialState',
  'deckTransport',
  'playDeck',
  'pauseDeck',
  'stopDeck',
  'seekDeck',
  'setPlaybackRate',
  'setCrossfader',
  'setCrossfaderCurve',
  'setDeckGain',
  'setDeckFader',
  'setDeckSide',
  'setLaneState',
  'removeLane',
  'setLoop',
  'setLoopRegion',
  'setMasterStems',
]);

export function performanceSupportForTake(capture) {
  const events = (capture.events || []).filter((event) => !event.disabled);
  const types = new Set(events.map((event) => event.type));
  const initial = events.find((event) => event.type === 'initialState')?.args?.[0];
  const selected = PERFORMANCE_SUPPORT.filter((item) =>
    item.events.some((type) => types.has(type))
  );
  const editable = new Set(),
    printed = new Set();
  if (initial?.decks?.some((deck) => Object.values(deck.lanes || {}).some((lane) => lane.assetId)))
    editable.add('Source clips');
  if (initial?.decks?.length) {
    for (const item of selected) {
      if (item.stages.arrange === 'printed') printed.add(item.label);
      else if (['transport', 'sources', 'loop', 'rate', 'mixer', 'stems'].includes(item.id))
        editable.add(item.destination);
    }
  } else if (selected.length) printed.add('Performance actions without a source snapshot');
  for (const deck of initial?.decks || []) {
    if (Object.values(deck.eq || {}).some((value) => value !== 50)) printed.add('Opening deck EQ');
    if ((deck.filter ?? 50) !== 50) printed.add('Opening deck filter');
    if (deck.fx?.reverb || deck.fx?.echo) printed.add('Opening deck effects');
    if (deck.pitch || Object.values(deck.stemPitch || {}).some(Boolean))
      printed.add('Opening pitch processing');
    if (deck.keyLock && (deck.playbackRate ?? 1) !== 1)
      printed.add('Opening key-locked tempo processing');
    if (
      Object.values(deck.stemFx || {}).some((fx) => fx.send || fx.pitch || (fx.filter ?? 50) !== 50)
    )
      printed.add('Opening stem effects');
  }
  if (
    events.some(
      (event) =>
        event.type === 'setLaneState' &&
        ['pitch', 'send', 'filter'].some(
          (key) =>
            event.args?.[2]?.[key] != null && event.args[2][key] !== (key === 'filter' ? 50 : 0)
        )
    )
  )
    printed.add('Lane pitch / filter / send changes');
  // Historical master processing is not reconstructed, even without new events.
  if (initial?.masterProcessing || initial?.compression || initial?.limiter)
    printed.add('Historical master processing');
  if (types.has('inputState'))
    printed.add(
      initial?.inputCaptureVersion === 1
        ? 'Input processing: compare its separate captured input lane'
        : 'Legacy input processing'
    );
  const known = new Set(['initialState', ...PERFORMANCE_SUPPORT.flatMap((item) => item.events)]);
  const unknown = [...types].filter((type) => !known.has(type));
  unknown.forEach((type) => printed.add(`Unclassified action: ${type}`));
  return {
    rows: selected,
    editable: [...editable],
    printed: [...printed],
    unknown,
    qualified: false,
  };
}
