// Key & BPM alpha: result shaping and CSV export. Measurement itself reuses the
// Stem Separator's analyzeStemAudio (Sattari AutoKey + the site's beat tracker).
import { trackTempo } from '../../utils/tempoMap';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const KEYBPM_MAX_FILES = 200;
export const KEYBPM_MAX_BYTES = 200 * 1024 ** 2;

// Names and byte lengths are not content identity (e.g. exports from two folders).
// Only hash candidates that otherwise look alike; cache by File identity for
// repeated selections within this tab. Failed reads are not cached as duplicates.
const fingerprints = new WeakMap();
async function fingerprint(file) {
  if (!fingerprints.has(file)) {
    const pending = file
      .arrayBuffer()
      .then((bytes) => crypto.subtle.digest('SHA-256', bytes))
      .then((bytes) => Array.from(new Uint8Array(bytes)).join(','));
    fingerprints.set(file, pending);
    pending.catch(() => fingerprints.delete(file));
  }
  return fingerprints.get(file);
}
export async function isDuplicateTrack(file, files) {
  const candidates = files.filter(
    (other) =>
      typeof other.arrayBuffer === 'function' &&
      other.name === file.name &&
      other.size === file.size
  );
  if (!candidates.length) return false;
  const digest = await fingerprint(file);
  for (const candidate of candidates) if (digest === (await fingerprint(candidate))) return true;
  return false;
}

export function keyParts(key) {
  const match = /^([A-G][#♯b♭]?)\s+(major|minor)$/.exec(String(key || '').trim());
  if (!match) return null;
  const name = match[1].replace('♯', '#').replace('♭', 'b');
  const flats = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
  const root = NOTES.indexOf(flats[name] || name);
  return root < 0 ? null : { root, minor: match[2] === 'minor' };
}

/** Camelot wheel code (8B = C major, 8A = A minor). */
export function camelot(key) {
  const parts = keyParts(key);
  if (!parts) return '';
  const majorRoot = parts.minor ? (parts.root + 3) % 12 : parts.root;
  return `${((7 * majorRoot + 7) % 12) + 1}${parts.minor ? 'A' : 'B'}`;
}

export const ROUGH_MIN_BPM = 70;
export const ROUGH_MAX_BPM = 180;
const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];

/**
 * A rough tempo for material where the strict estimator declined (pulse varies
 * between sections). Uses up to 60 s from the middle of the track, folded to
 * 70–180 BPM.
 */
export function roughTempo(left, right, rate) {
  const stride = Math.max(1, Math.floor(rate / 11025));
  const seconds = Math.min(60, left.length / rate);
  const from = Math.floor((left.length - seconds * rate) / 2);
  const length = Math.floor((seconds * rate) / stride);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let j = 0; j < stride; j++) {
      const at = from + i * stride + j;
      sum += (left[at] + right[at]) / 2;
    }
    samples[i] = sum / stride;
  }
  const tempo = trackTempo(samples, rate / stride);
  const beats = tempo.beats.filter((beat) => !beat.inferred);
  if (beats.length < 8 || !(tempo.confidence >= 0.3)) return null;
  const intervals = tempo.beats.slice(1).map((beat, i) => beat.time - tempo.beats[i].time);
  let bpm = 60 / median(intervals);
  if (!Number.isFinite(bpm) || bpm <= 0) return null;
  // Fold into the usual DJ range; the low-confidence path often locks to double time.
  while (bpm > ROUGH_MAX_BPM) bpm /= 2;
  while (bpm < ROUGH_MIN_BPM) bpm *= 2;
  return Math.round(bpm);
}

const KEY_NOTES = {
  quiet: 'Too quiet',
  short: 'Shorter than 3 s',
  'limited-harmony': 'Not enough tonal evidence',
};
const TEMPO_NOTES = {
  quiet: 'Too quiet',
  short: 'Shorter than 3 s',
  'no-pulse': 'No steady pulse found',
  variable: 'Tempo varies between sections',
};

/** One table row from an analyzeStemAudio result (+ optional rough tempo). */
export function resultRow(fileName, analysis, rough = null) {
  if (!analysis || analysis.status !== 'ready')
    return { file: fileName, status: 'error', note: 'Analysis unavailable for this file.' };
  const bpm = analysis.bpm ?? rough;
  const notes = [];
  if (!analysis.key && KEY_NOTES[analysis.keyReason])
    notes.push(`Key: ${KEY_NOTES[analysis.keyReason]}`);
  if (analysis.bpm === null && TEMPO_NOTES[analysis.tempoReason])
    notes.push(`BPM: ${TEMPO_NOTES[analysis.tempoReason]}${rough ? ' (rough value shown)' : ''}`);
  return {
    file: fileName,
    status: 'done',
    duration: analysis.duration,
    key: analysis.key || '',
    camelot: camelot(analysis.key),
    keyConfidence: analysis.keyConfidence,
    keyEvidence: analysis.key ? analysis.keyEvidence : 'insufficient',
    alternative: analysis.key ? analysis.keyAlternative || '' : '',
    bpm: bpm ?? null,
    tempoEvidence:
      analysis.bpm !== null ? analysis.tempoEvidence : rough ? 'rough' : 'insufficient',
    rmsDb: analysis.rmsDb,
    peakDb: analysis.peakDb,
    note: notes.join('; '),
  };
}

// Quote every cell and neutralise spreadsheet formulas (=, +, -, @ prefixes).
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const CSV_COLUMNS = [
  ['File', (row) => row.file],
  ['Duration (s)', (row) => (Number.isFinite(row.duration) ? row.duration.toFixed(1) : '')],
  ['Key', (row) => row.key],
  ['Camelot', (row) => row.camelot],
  ['Key evidence', (row) => row.keyEvidence],
  ['Key margin', (row) => (Number.isFinite(row.keyConfidence) ? row.keyConfidence.toFixed(3) : '')],
  ['Alternative key', (row) => row.alternative],
  ['BPM', (row) => row.bpm ?? ''],
  ['BPM evidence', (row) => row.tempoEvidence],
  ['RMS dBFS', (row) => row.rmsDb ?? ''],
  ['Peak dBFS', (row) => row.peakDb ?? ''],
  ['Status', (row) => row.status],
  ['Notes', (row) => row.note || ''],
];

export function resultsCsv(rows) {
  const lines = [CSV_COLUMNS.map(([name]) => csvCell(name)).join(',')];
  for (const row of rows) lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(row))).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

// ---- Musician corrections (metadata only) --------------------------------
// The detected result is never modified. A correction is stored beside it as
// { key, bpm, bpmChoice, editedAt } and only changes what is displayed,
// sorted and exported as "corrected". It does not stretch or transpose audio.

export const ALL_KEYS = [
  ...NOTES.map((note) => `${note} major`),
  ...NOTES.map((note) => `${note} minor`),
];
export const BPM_MIN = 20;
export const BPM_MAX = 400;
export const BPM_CHOICES = ['half', 'double', 'tap', 'manual'];

/** A finite positive BPM within range, keeping up to two decimals; else null. */
export function normalizeBpm(value) {
  const number = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return null;
  if (number < BPM_MIN || number > BPM_MAX) return null;
  return Math.round(number * 100) / 100;
}

export const formatBpm = (bpm) =>
  bpm === null || bpm === undefined ? '' : String(Math.round(bpm * 100) / 100);

/** Half / double interpretation of the detected tempo (null if out of range). */
export function tempoInterpretation(detectedBpm, choice) {
  if (!Number.isFinite(detectedBpm)) return null;
  if (choice === 'half') return normalizeBpm(detectedBpm / 2);
  if (choice === 'double') return normalizeBpm(detectedBpm * 2);
  return normalizeBpm(detectedBpm);
}

/** Sanitized correction, or null when nothing differs from the detection. */
export function cleanCorrection(user) {
  if (!user || typeof user !== 'object') return null;
  const key = typeof user.key === 'string' && ALL_KEYS.includes(user.key) ? user.key : null;
  const bpm = normalizeBpm(user.bpm);
  const bpmChoice = bpm !== null && BPM_CHOICES.includes(user.bpmChoice) ? user.bpmChoice : null;
  if (key === null && bpm === null) return null;
  return {
    key,
    bpm,
    bpmChoice: bpm === null ? null : bpmChoice || 'manual',
    editedAt: typeof user.editedAt === 'string' ? user.editedAt : new Date().toISOString(),
  };
}

/** What to show for a row: corrected values win, each labelled by its source. */
export function effectiveValues(result, user) {
  const correction = cleanCorrection(user);
  const key = correction?.key ?? (result?.key || '');
  const bpm = correction?.bpm ?? result?.bpm ?? null;
  return {
    key,
    camelot: camelot(key),
    bpm,
    keySource: correction?.key ? 'user' : 'detected',
    bpmSource:
      correction?.bpm !== null && correction?.bpm !== undefined ? correction.bpmChoice : 'detected',
  };
}

/**
 * Tap tempo: the average of the most recent intervals. A pause longer than
 * resetMs starts a new count. Needs at least three taps for a value.
 */
export function createTapTempo({ maxTaps = 8, resetMs = 2500 } = {}) {
  let taps = [];
  return {
    tap(at = performance.now()) {
      if (taps.length && at - taps[taps.length - 1] > resetMs) taps = [];
      if (taps.length && at <= taps[taps.length - 1]) return this.value();
      taps.push(at);
      if (taps.length > maxTaps) taps.shift();
      return this.value();
    },
    value() {
      if (taps.length < 3) return null;
      const span = taps[taps.length - 1] - taps[0];
      return normalizeBpm(Math.round((60000 * (taps.length - 1) * 10) / span) / 10);
    },
    count: () => taps.length,
    reset() {
      taps = [];
    },
  };
}

export const CORRECTION_COLUMNS = [
  ['Corrected key', (row) => row.user?.key || ''],
  ['Corrected Camelot', (row) => (row.user?.key ? camelot(row.user.key) : '')],
  ['Corrected BPM', (row) => formatBpm(row.user?.bpm ?? null)],
  ['BPM correction', (row) => (row.user?.bpm != null ? row.user.bpmChoice : '')],
  ['Corrected at', (row) => (row.user ? row.user.editedAt : '')],
  ['Source', (row) => row.origin?.label || ''],
];

/**
 * CSV of detected measurements, with the musician's corrections in separate
 * trailing columns so existing spreadsheets keep their column positions.
 * rows: [{ result, user?, origin? }]
 */
export function correctedResultsCsv(rows) {
  const columns = [...CSV_COLUMNS, ...CORRECTION_COLUMNS];
  const lines = [columns.map(([name]) => csvCell(name)).join(',')];
  for (const row of rows)
    lines.push(
      columns
        .map(([, get], index) => csvCell(index < CSV_COLUMNS.length ? get(row.result) : get(row)))
        .join(',')
    );
  return `${lines.join('\r\n')}\r\n`;
}
