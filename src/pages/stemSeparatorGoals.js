import { STEMS } from '../utils/stemSeparator';

const ALL = STEMS.map((stem) => stem.id);
const LABELS = { vocals: 'Vocals', drums: 'Drums', bass: 'Bass', other: 'Other instruments' };

/** Display name for a model stem. "other" is the residual instruments stem. */
export const stemLabel = (id) => LABELS[id] || id;

// What the musician wants, mapped onto the four supported stems. Every
// practice goal separates all four parts so the player can build the mix and
// the musician can still change their mind afterwards.
export const SEPARATOR_GOALS = [
  { id: 'all', label: 'Separate all parts', detail: 'Vocals, drums, bass and other instruments.' },
  { id: 'no-vocals', label: 'Vocal backing track', detail: 'Drums + bass + other instruments.' },
  { id: 'no-drums', label: 'Drum practice', detail: 'Everything except the drums.' },
  { id: 'no-bass', label: 'Bass practice', detail: 'Everything except the bass.' },
  { id: 'solo:vocals', label: 'Solo a part', detail: 'Hear one part alone. Starts on vocals.' },
  { id: 'custom', label: 'Custom', detail: 'Choose which stems to keep.' },
];

/** Stems to separate for a goal (null = keep the user's custom selection). */
export function goalStems(goal) {
  return goal === 'custom' ? null : ALL;
}

// Shareable links: /stem-separator?goal=drum-practice opens that goal.
export const GOAL_LINKS = {
  all: 'all',
  'vocal-backing': 'no-vocals',
  karaoke: 'no-vocals',
  'drum-practice': 'no-drums',
  drumless: 'no-drums',
  'bass-practice': 'no-bass',
  bassless: 'no-bass',
  'solo-vocals': 'solo:vocals',
  'solo-drums': 'solo:drums',
  'solo-bass': 'solo:bass',
  'solo-other': 'solo:other',
  custom: 'custom',
};
export const GOAL_SLUGS = {
  all: 'all',
  'no-vocals': 'vocal-backing',
  'no-drums': 'drum-practice',
  'no-bass': 'bass-practice',
  'solo:vocals': 'solo-vocals',
  'solo:drums': 'solo-drums',
  'solo:bass': 'solo-bass',
  'solo:other': 'solo-other',
  custom: 'custom',
};
/** Goal id from a ?goal= value, or null when absent or unknown. */
export const goalFromLink = (value) =>
  Object.hasOwn(GOAL_LINKS, String(value || '').toLowerCase())
    ? GOAL_LINKS[String(value).toLowerCase()]
    : null;
