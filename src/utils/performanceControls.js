const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const mediaData = new Set(['waveform', 'peaks', 'buffer', 'data', 'notes']);
const argumentNames = {
  deckTransport: ['Deck', 'Transport'],
  setDeckGain: ['Deck', 'Gain'],
  setDeckFader: ['Deck', 'Fader'],
  setDeckFilter: ['Deck', 'Filter'],
  setDeckPitch: ['Deck', 'Pitch'],
  setPlaybackRate: ['Deck', 'Rate'],
  setStemPitch: ['Deck', 'Stem', 'Pitch'],
  setDeckKeyLock: ['Deck', 'Key lock'],
  setLaneState: ['Deck', 'Stem', 'Lane'],
  setLaneFx: ['Deck', 'Stem', 'Effect'],
  setLoopRegion: ['Deck', 'Enabled', 'Loop start', 'Loop end'],
  setLoop: ['Deck', 'Enabled', 'BPM'],
  setCrossfader: ['Crossfader'],
  setMasterLevel: ['Level'],
  setLimiter: ['Limiter enabled'],
  setMasterAssist: ['Enabled', 'Mode'],
  triggerPad: ['Pad', 'Voice'],
  setPadGain: ['Pad', 'Gain'],
  playDeck: ['Deck', 'Position'],
  seekDeck: ['Deck', 'Position'],
  inputState: ['Input'],
};
const label = (key) =>
  String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());

export function performanceControlFields(event) {
  if (event.type === 'initialState') return [];
  const fields = [];
  const visit = (value, path, name) => {
    if (path.length > 8 || fields.length >= 128) return;
    if (typeof value === 'number' || typeof value === 'boolean') {
      // Numeric pad/deck identity is a target, not an automatable parameter.
      if (path.length === 1 && ['Pad', 'Deck'].includes(name)) return;
      fields.push({ path, name, value, type: typeof value });
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value))
        if (!forbidden.has(key) && !mediaData.has(key))
          visit(child, [...path, key], `${name} · ${label(key)}`);
    }
  };
  (event.args || []).forEach((value, index) =>
    visit(value, [index], argumentNames[event.type]?.[index] || `Value ${index + 1}`)
  );
  return fields;
}

export function setPerformanceControl(event, path, value) {
  const field = performanceControlFields(event).find(
    (item) => JSON.stringify(item.path) === JSON.stringify(path)
  );
  if (!field || typeof value !== field.type || (field.type === 'number' && !Number.isFinite(value)))
    throw new Error('Invalid performance control.');
  const args = structuredClone(event.args);
  let target = args;
  for (const key of path.slice(0, -1)) target = target[key];
  target[path.at(-1)] = value;
  return args;
}
