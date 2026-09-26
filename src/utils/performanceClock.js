// These setters schedule their parameter ramps at Tone.now(). Preserve that
// actual time, rather than re-applying a potentially different replay lookahead.
export const TIMED_PARAMETERS = new Set([
  'setCrossfader',
  'setCrossfaderCurve',
  'setDeckGain',
  'setDeckFader',
  'setDeckSide',
  'setDeckEq',
  'setDeckFilter',
  'setDeckFx',
  'setLaneState',
  'setMasterStems',
  'setMasterLevel',
  'setLimiter',
  'setMasterAssist',
  'setMasterProcessing',
  'setLoop',
  'setLoopRegion',
]);

export function parameterRamp(engine, param, value, duration) {
  if (engine.performanceParameterTime != null)
    param.rampTo(value, duration, engine.performanceParameterTime);
  else param.rampTo(value, duration);
}

export function performanceAudioTime(event, sampleRate, legacyLookAhead = 0) {
  const seconds = Number.isFinite(event.scheduledTime)
    ? event.scheduledTime
    : event.time + (['deckTransport', 'inputState'].includes(event.type) ? 0 : legacyLookAhead);
  return Math.round(seconds * sampleRate) / sampleRate;
}

export function retimePerformanceEvent(event, time) {
  const next = { ...event, time };
  if (event.sampleRate > 0) next.frame = Math.round(time * event.sampleRate);
  if (Number.isFinite(event.scheduledTime)) {
    next.scheduledTime = Math.max(0, time + event.scheduledTime - event.time);
    if (event.sampleRate > 0)
      next.scheduledFrame = Math.round(next.scheduledTime * event.sampleRate);
  }
  return next;
}
