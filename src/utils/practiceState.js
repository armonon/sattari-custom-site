// What the stem player remembers for each song: the mix, speed and key, the
// current loop, named saved loops and the beat-tool switches. Everything read
// back from storage goes through cleanPracticeState, so a damaged or outdated
// record can only ever fall back to defaults.
import { MAX_GAIN, MAX_MASTER } from './stemMix.js';

export const PRACTICE_VERSION = 1;
export const MAX_SECTIONS = 12;
export const SECTION_NAME_MAX = 40;
const MIN_LOOP = 0.25;
const SPEED_MIN = 0.5;
const SPEED_MAX = 1.25;
const SEMITONE_RANGE = 6;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

/** One line of plain text for a saved loop's name. */
export function cleanSectionName(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const visible = Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  }).join('');
  return (
    visible
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, SECTION_NAME_MAX)
      .trim() || fallback
  );
}

function cleanRange(range, duration) {
  if (!range || !finite(range.a) || !finite(range.b)) return null;
  const limit = finite(duration) && duration > 0 ? duration : Infinity;
  const a = clamp(range.a, 0, limit);
  const b = clamp(range.b, 0, limit);
  return b - a >= MIN_LOOP ? { a, b } : null;
}

function cleanMix(mix, ids) {
  if (!mix || typeof mix !== 'object' || !mix.lanes || typeof mix.lanes !== 'object') return null;
  const lanes = {};
  for (const id of ids) {
    const lane = mix.lanes[id];
    // A record for a different set of parts is not applied at all.
    if (!lane || typeof lane !== 'object' || !finite(lane.gain)) return null;
    lanes[id] = {
      gain: clamp(lane.gain, 0, MAX_GAIN),
      muted: lane.muted === true,
      solo: lane.solo === true,
    };
  }
  return { lanes, master: finite(mix.master) ? clamp(mix.master, 0, MAX_MASTER) : 1 };
}

/**
 * Sanitized practice state for a song with the given stem ids and duration,
 * or null when there is nothing usable. Unknown fields are dropped.
 */
export function cleanPracticeState(value, ids, duration) {
  if (!value || typeof value !== 'object' || value.v !== PRACTICE_VERSION) return null;
  const sections = [];
  const seen = new Set();
  for (const section of Array.isArray(value.sections) ? value.sections : []) {
    if (sections.length >= MAX_SECTIONS) break;
    const range = cleanRange(section, duration);
    const id = typeof section?.id === 'string' && section.id.length <= 64 ? section.id : '';
    if (!range || !id || seen.has(id)) continue;
    seen.add(id);
    sections.push({
      id,
      name: cleanSectionName(section.name, `Loop ${sections.length + 1}`),
      ...range,
    });
  }
  return {
    v: PRACTICE_VERSION,
    mix: cleanMix(value.mix, ids),
    speed: finite(value.speed) ? Math.round(clamp(value.speed, SPEED_MIN, SPEED_MAX) * 20) / 20 : 1,
    semitones: Number.isInteger(value.semitones)
      ? clamp(value.semitones, -SEMITONE_RANGE, SEMITONE_RANGE)
      : 0,
    loop: cleanRange(value.loop, duration),
    sections,
    click: value.click === true,
    countIn: value.countIn === true,
    snap: value.snap !== false,
    barOffset: Number.isInteger(value.barOffset) ? clamp(value.barOffset, 0, 3) : 0,
    headroom: value.headroom === 'prevent-clipping' ? 'prevent-clipping' : 'none',
  };
}
