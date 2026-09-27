// Return bus settings (A reverb, B delay) as saved in the session. The engine's
// normalizer is a pure module, so the session model can share it directly.
import { normalizeReturns } from '../../utils/mixerReturns';

export { normalizeReturns };

/** The session's `mixer` record. */
export function normalizeMixer(value) {
  return { returns: normalizeReturns(value?.returns) };
}
