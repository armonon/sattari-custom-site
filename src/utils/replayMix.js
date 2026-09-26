import { crossfaderGains, gainFromPercent } from './studioAudioEngine';
import { masterStemGain, normalizeMasterStems } from './masterOutput';
export const MIX_EVENTS = new Set([
  'setCrossfader',
  'setCrossfaderCurve',
  'setDeckGain',
  'setDeckFader',
  'setDeckSide',
  'setLaneState',
  'setMasterStems',
]);
export function canScheduleMix(events) {
  return !events.some(
    (event) =>
      event.type === 'removeLane' ||
      (event.type === 'setLaneState' &&
        Object.keys(event.args[2] || {}).some((key) => !['level', 'muted', 'solo'].includes(key)))
  );
}
// Keep a separate future mixer state. Scheduling a future mute must not change
// today's live logical state or overwrite a following fader/solo automation point.
export function mixAutomation(initial) {
  const state = {
    crossfader: initial.crossfader ?? 50,
    curve: initial.crossfaderCurve || 'Smooth',
    stems: normalizeMasterStems(initial.masterProcessing?.stems),
    decks: new Map(
      (initial.decks || []).map((d) => [
        d.id,
        {
          gain: d.gain ?? 100,
          fader: d.fader ?? 100,
          side: d.cfSide || d.side || 'left',
          lanes: structuredClone(d.lanes || {}),
        },
      ])
    ),
  };
  return (event) => {
    const [id, value, updates] = event.args;
    const deck = state.decks.get(id);
    const type = event.type;
    if (type === 'setCrossfader') state.crossfader = id;
    if (type === 'setCrossfaderCurve')
      state.curve = ['Smooth', 'Sharp', 'Linear'].includes(id) ? id : 'Smooth';
    if (deck && type === 'setDeckGain') deck.gain = value;
    if (deck && type === 'setDeckFader') deck.fader = value;
    if (deck && type === 'setDeckSide') deck.side = value;
    if (deck?.lanes[value] && type === 'setLaneState') Object.assign(deck.lanes[value], updates);
    if (type === 'setMasterStems') state.stems = normalizeMasterStems(id);
    if (type === 'setMasterProcessing') state.stems = normalizeMasterStems(id?.stems);
    const ramps = [];
    const stemChange = ['setMasterStems', 'setMasterProcessing'].includes(type);
    const global = stemChange || ['setCrossfader', 'setCrossfaderCurve'].includes(type);
    for (const [deckId, current] of state.decks) {
      if (!global && deckId !== id) continue;
      if (type === 'setLaneState' || stemChange) {
        const solo = Object.values(current.lanes).some((lane) => lane.solo);
        for (const [laneId, lane] of Object.entries(current.lanes)) {
          const gain =
            lane.muted || (solo && !lane.solo)
              ? 0
              : gainFromPercent(lane.level ?? 100) * masterStemGain(state.stems, laneId);
          ramps.push({ target: 'lane', deckId, laneId, value: gain });
        }
      } else {
        const sides = crossfaderGains(state.crossfader, state.curve);
        const side =
          current.side === 'left' ? sides.left : current.side === 'right' ? sides.right : 1;
        ramps.push({
          target: 'deck',
          deckId,
          value: gainFromPercent(current.gain) * gainFromPercent(current.fader) * side,
        });
      }
    }
    if (stemChange)
      ramps.push({ target: 'unseparated', value: masterStemGain(state.stems, 'unseparated') });
    return ramps;
  };
}
