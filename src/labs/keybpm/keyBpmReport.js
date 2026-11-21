import {
  ALL_KEYS,
  BPM_CHOICES,
  camelot,
  keyParts,
  KEYBPM_MAX_BYTES,
  KEYBPM_MAX_FILES,
  normalizeBpm,
} from './keyBpm';

export const KEYBPM_REPORT_MAX_BYTES = 2 * 1024 * 1024;
export const KEYBPM_REPORT_SCHEMA = 'SattariKeyBpm.report';
// Version 2 adds optional per-track `user` corrections and `origin` labels.
// Version 1 reports (no corrections) still open unchanged.
export const KEYBPM_REPORT_VERSION = 2;
const SUPPORTED_VERSIONS = [1, 2];
export const KEYBPM_REPORT_LIMITS = [
  'Previously measured results only. Source audio is not included; choose audio files to analyze again.',
  'One global key estimate per track; key changes, modal and atonal music are not separately identified.',
  'Tempo can be half/double time. Rough estimates use one middle segment and fold into 70–180 BPM.',
  'Fixture-tested estimates, not accuracy-certified against a labelled music corpus.',
  'Report structure is validated; imported measurements are not re-verified without original audio.',
  'Corrected key and BPM values are the musician’s own choices, stored separately from the detected estimate. They do not change the audio.',
];
const invalid = () => {
  throw new Error('Invalid or unsupported Key & BPM report. Existing tracks were not changed.');
};
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max, empty = true) => {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.length)) invalid();
  return value;
};
const number = (value, min, max, nullable = false) => {
  if (nullable && value === null) return null;
  if (!Number.isFinite(value) || value < min || value > max) invalid();
  return value;
};
const timestamp = (value) => {
  text(value, 40, false);
  if (!Number.isFinite(Date.parse(value))) invalid();
  return value;
};
const evidence = (value) => {
  if (!['supported', 'tentative', 'insufficient', 'rough'].includes(value)) invalid();
  return value;
};
function track(record, version) {
  if (!object(record) || !object(record.source) || !object(record.result)) invalid();
  const source = {
    name: text(record.source.name, 512, false),
    size: number(record.source.size, 0, KEYBPM_MAX_BYTES),
    type: text(record.source.type, 128),
    lastModified: number(record.source.lastModified, 0, Number.MAX_SAFE_INTEGER),
  };
  if (!Number.isInteger(source.size) || !Number.isInteger(source.lastModified)) invalid();
  const original = record.result;
  if (original.file !== source.name || !['done', 'error'].includes(original.status)) invalid();
  const result = { file: source.name, status: original.status, note: text(original.note, 2048) };
  if (original.status === 'done') {
    const key = text(original.key, 24),
      alternative = text(original.alternative, 24);
    if (
      (key && !keyParts(key)) ||
      (alternative && !keyParts(alternative)) ||
      original.camelot !== camelot(key)
    )
      invalid();
    Object.assign(result, {
      duration: number(original.duration, Number.MIN_VALUE, 600),
      key,
      camelot: original.camelot,
      keyConfidence: number(original.keyConfidence, 0, 1, true),
      keyEvidence: evidence(original.keyEvidence),
      alternative,
      bpm: number(original.bpm, 1, 1000, true),
      tempoEvidence: evidence(original.tempoEvidence),
      rmsDb: number(original.rmsDb, -1000, 1000, true),
      peakDb: number(original.peakDb, -1000, 1000, true),
    });
    if (
      result.keyEvidence === 'rough' ||
      (!key && result.keyEvidence !== 'insufficient') ||
      (!key && result.keyConfidence !== null) ||
      (result.bpm === null && result.tempoEvidence !== 'insufficient')
    )
      invalid();
  }
  const parsed = { source, result, measuredAt: timestamp(record.measuredAt) };
  if (version >= 2 && record.user !== undefined && record.user !== null) {
    const user = record.user;
    if (!object(user)) invalid();
    const key = user.key === null ? null : text(user.key, 24, false);
    if (key !== null && !ALL_KEYS.includes(key)) invalid();
    const bpm = user.bpm === null ? null : normalizeBpm(user.bpm);
    if (user.bpm !== null && (bpm === null || bpm !== user.bpm)) invalid();
    const bpmChoice = user.bpmChoice === null ? null : user.bpmChoice;
    if ((bpm === null) !== (bpmChoice === null)) invalid();
    if (bpmChoice !== null && !BPM_CHOICES.includes(bpmChoice)) invalid();
    if (key === null && bpm === null) invalid();
    if (result.status !== 'done') invalid();
    parsed.user = { key, bpm, bpmChoice, editedAt: timestamp(user.editedAt) };
  }
  if (version >= 2 && record.origin !== undefined && record.origin !== null) {
    if (!object(record.origin) || !['original', 'stem', 'mix'].includes(record.origin.kind))
      invalid();
    parsed.origin = { kind: record.origin.kind, label: text(record.origin.label, 200, false) };
  }
  return parsed;
}
export function parseKeyBpmReport(textValue) {
  if (
    typeof textValue !== 'string' ||
    new TextEncoder().encode(textValue).length > KEYBPM_REPORT_MAX_BYTES
  )
    invalid();
  let report;
  try {
    report = JSON.parse(textValue);
  } catch {
    invalid();
  }
  if (
    !object(report) ||
    report.schema !== KEYBPM_REPORT_SCHEMA ||
    !SUPPORTED_VERSIONS.includes(report.version) ||
    !Array.isArray(report.tracks) ||
    !report.tracks.length ||
    report.tracks.length > KEYBPM_MAX_FILES
  )
    invalid();
  return {
    schema: KEYBPM_REPORT_SCHEMA,
    // Opened reports are migrated in memory to the current version.
    version: KEYBPM_REPORT_VERSION,
    sourceVersion: report.version,
    createdAt: timestamp(report.createdAt),
    limits: [...KEYBPM_REPORT_LIMITS],
    tracks: report.tracks.map((record) => track(record, report.version)),
  };
}
export function createKeyBpmReport(rows, createdAt = new Date().toISOString()) {
  const report = {
    schema: KEYBPM_REPORT_SCHEMA,
    version: KEYBPM_REPORT_VERSION,
    createdAt,
    limits: [...KEYBPM_REPORT_LIMITS],
    tracks: rows.map((row) => ({
      source: {
        name: row.file.name,
        size: row.file.size,
        type: row.file.type,
        lastModified: row.file.lastModified,
      },
      measuredAt: row.measuredAt,
      result: row.result,
      ...(row.user ? { user: row.user } : {}),
      ...(row.origin ? { origin: { kind: row.origin.kind, label: row.origin.label } } : {}),
    })),
  };
  // Apply the exact same schema on export and import. Never save a file that
  // this version cannot reopen, or infer absent source audio from metadata.
  const checked = parseKeyBpmReport(JSON.stringify(report));
  delete checked.sourceVersion;
  return JSON.stringify(checked, null, 2);
}
