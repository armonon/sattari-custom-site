// Mixer values stored on decks and tracks, plus the per-device headphone cue
// preferences. Pure functions only: this module is imported by the session
// model, so it must not pull in the audio engine.
import { validateEffects } from '../../utils/arrangementEffects';
import {
  CUE_MODES,
  DEFAULT_CUE as ENGINE_CUE,
  normalizeCue as normalizeEngineCue,
} from '../../utils/cueRouting';
import { RETURN_BUSES, RETURN_DIVISIONS } from '../../utils/mixerReturns';

export const SEND_BUSES = RETURN_BUSES;

export const RETURN_NAMES = { a: 'Reverb', b: 'Delay' };

const DIVISION_LABELS = { '1/8d': '1/8 dotted', '1/4d': '1/4 dotted' };
/** [id, label] for every tempo division the delay return supports. */
export const DELAY_DIVISIONS = Object.keys(RETURN_DIVISIONS).map((id) => [
  id,
  DIVISION_LABELS[id] || id,
]);

export { CUE_MODES };

/** Headphone cue preferences of this device; the output device is kept alongside. */
export const DEFAULT_CUE = Object.freeze({ ...ENGINE_CUE, deviceId: '' });

/** A 0-100 control value; anything that is not a finite number becomes `fallback`. */
export function percent(value, fallback) {
  const number =
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? +value : NaN;
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback;
}

/** Send A (reverb) and B (delay) levels; missing or damaged values are 0. */
export function normalizeSends(value) {
  return { a: percent(value?.a, 0), b: percent(value?.b, 0) };
}

/** A deck's insert chain in the arrangement effect format, or none if damaged. */
export function normalizeInserts(value) {
  if (!Array.isArray(value)) return [];
  try {
    return validateEffects(value);
  } catch {
    return [];
  }
}

export function normalizeCue(value) {
  return {
    ...normalizeEngineCue(value, ENGINE_CUE),
    deviceId: typeof value?.deviceId === 'string' ? value.deviceId : DEFAULT_CUE.deviceId,
  };
}
