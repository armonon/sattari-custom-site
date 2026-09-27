// Conversions between stored forms (autosave, portable project, Learn hand-off)
// and the session snapshot that applySession consumes. A snapshot holds every
// persisted session field plus `arrangerSource`, the input migrateArrangement
// reads once the snapshot's decks are hydrated.
import { performanceAssetIds, relinkPerformanceAssets } from '../../utils/performanceReplay';
import { normalizeMasterProcessing } from '../../utils/masterOutput';
import { normalizeMixer } from '../mixer/mixerReturns';
import { DECK_SEEDS, clampNumber, createPads, normalizeDecks } from './sessionModel';

const TRANSFER_KEY = 'sattari-studio-transfer-v1';

const PROJECT_SCHEMAS = [
  'SattariStudio.project.v2',
  'SattariStudio.project.v3',
  'SattariStudio.project.v4',
  'SattariStudio.project.v5',
  'SattariStudio.project.v6',
];

/** Opens a track analysed on the Learn page in Deck A, consuming the hand-off. */
export function consumeLearnTransfer(decks) {
  try {
    const storage = window.localStorage;
    const value = storage.getItem(TRANSFER_KEY);
    if (!value) return { decks, transfer: null };
    const transfer = JSON.parse(value);
    const first = decks[0];
    const next = [
      {
        ...first,
        title: transfer.trackName || first.title,
        keyName: transfer.key || first.keyName,
        sourceKeyName: transfer.key || first.sourceKeyName,
        bpm: transfer.bpm || first.bpm,
        duration: transfer.analysis?.duration || first.duration,
        waveform: transfer.analysis?.waveform || first.waveform,
        analysis: transfer.analysis || first.analysis,
        lanes: {
          ...first.lanes,
          fullMix: {
            ...first.lanes.fullMix,
            assetId: transfer.audioAssetId || first.lanes.fullMix.assetId,
            name: transfer.trackName || first.lanes.fullMix.name,
            status: transfer.audioAssetId ? 'loading' : first.lanes.fullMix.status,
          },
        },
      },
      ...decks.slice(1),
    ];
    storage.removeItem(TRANSFER_KEY);
    return { decks: next, transfer };
  } catch {
    return { decks, transfer: null };
  }
}

/**
 * Snapshot of an autosaved session. `snapshotFromSaved(null)` is a brand-new
 * session, so New project and a first visit start from identical state.
 */
export function snapshotFromSaved(saved, { decks = normalizeDecks(saved?.decks), transfer } = {}) {
  const savedHasAudio = Boolean(
    saved?.decks?.some((deck) => Object.values(deck?.lanes || {}).some((lane) => lane?.assetId))
  );
  // Pre-v2 empty sessions stored placeholder level/tempo values.
  const migrateLegacyEmptySession = (saved?.uiSchemaVersion || 0) < 2 && !savedHasAudio;
  const restoredMasterLevel = migrateLegacyEmptySession ? 100 : (saved?.masterLevel ?? 100);
  const restoredMasterBpm = migrateLegacyEmptySession ? 120 : (saved?.masterBpm ?? 120);
  return {
    sessionName:
      saved?.sessionName || (transfer ? `${transfer.trackName} session` : 'Untitled session'),
    decks,
    pads: createPads(saved?.pads),
    pianoNotes: Array.isArray(saved?.pianoNotes) ? saved.pianoNotes : [],
    recordings: saved?.recordings || [],
    crossfader: saved?.crossfader ?? 50,
    crossfaderCurve: saved?.crossfaderCurve || 'Smooth',
    crossfaderReverse: saved?.crossfaderReverse ?? false,
    masterLevel: restoredMasterLevel,
    masterProcessing: normalizeMasterProcessing(saved?.masterProcessing),
    mixer: normalizeMixer(saved?.mixer),
    masterBpm: transfer?.bpm || restoredMasterBpm,
    projectKey: saved?.projectKey || 'Off',
    limiter: saved?.limiter ?? true,
    aiMaster: saved?.aiMaster ?? false,
    aiMasterMode: saved?.aiMasterMode || 'Streaming -14',
    transfer: transfer ?? null,
    arrangerSource: saved || {},
  };
}

export function isProjectManifest(manifest) {
  return (
    PROJECT_SCHEMAS.includes(manifest?.schema) &&
    Array.isArray(manifest.decks) &&
    manifest.decks.length <= DECK_SEEDS.length &&
    (manifest.pads == null || Array.isArray(manifest.pads)) &&
    (manifest.recordings == null || Array.isArray(manifest.recordings)) &&
    (manifest.pianoNotes == null || Array.isArray(manifest.pianoNotes))
  );
}

/** Points a manifest at the local IDs its embedded audio was stored under. */
export function relinkManifestAssets(manifest, importedIds) {
  for (const deck of manifest.decks)
    for (const lane of Object.values(deck?.lanes || {})) {
      if (lane && importedIds.has(lane.assetId)) lane.assetId = importedIds.get(lane.assetId);
    }
  for (const pad of manifest.pads || [])
    if (pad && importedIds.has(pad.assetId)) pad.assetId = importedIds.get(pad.assetId);
  for (const recording of manifest.recordings || [])
    if (recording && importedIds.has(recording.id)) recording.id = importedIds.get(recording.id);
  if (manifest.arranger) {
    for (const pattern of Object.values(manifest.arranger.patterns || {}))
      if (importedIds.has(pattern.assetId)) pattern.assetId = importedIds.get(pattern.assetId);
    for (const track of manifest.arranger.tracks)
      for (const clip of track.clips)
        if (importedIds.has(clip.assetId)) clip.assetId = importedIds.get(clip.assetId);
    for (const capture of manifest.arranger.captures)
      if (importedIds.has(capture.assetId)) capture.assetId = importedIds.get(capture.assetId);
    relinkPerformanceAssets(manifest.arranger.captures, importedIds);
  }
  return manifest;
}

export function snapshotFromManifest(manifest) {
  const master = manifest.master;
  return {
    sessionName: manifest.sessionName || 'Imported session',
    decks: normalizeDecks(manifest.decks),
    pads: createPads(manifest.pads || []),
    pianoNotes: manifest.pianoNotes || [],
    recordings: manifest.recordings || [],
    crossfader: master?.crossfader ?? 50,
    crossfaderCurve: master?.crossfaderCurve || 'Smooth',
    crossfaderReverse: master?.crossfaderReverse ?? false,
    masterLevel: master?.level ?? 100,
    masterProcessing: normalizeMasterProcessing(master?.processing),
    mixer: normalizeMixer(manifest.mixer),
    masterBpm: clampNumber(master?.bpm ?? 120, 40, 240),
    projectKey: master?.projectKey || 'Off',
    limiter: master?.limiter ?? true,
    aiMaster: master?.aiMaster ?? false,
    aiMasterMode: master?.aiMasterMode || 'Streaming -14',
    transfer: manifest.source || null,
    arrangerSource: manifest,
  };
}

/** The autosave record. Field order is kept stable for diffing saved sessions. */
export function autosavePayload(session) {
  return {
    uiSchemaVersion: 2,
    sessionName: session.sessionName,
    decks: session.decks,
    pads: session.pads,
    recordings: session.recordings,
    crossfader: session.crossfader,
    crossfaderCurve: session.crossfaderCurve,
    crossfaderReverse: session.crossfaderReverse,
    masterLevel: session.masterLevel,
    masterProcessing: session.masterProcessing,
    masterBpm: session.masterBpm,
    projectKey: session.projectKey,
    limiter: session.limiter,
    aiMaster: session.aiMaster,
    aiMasterMode: session.aiMasterMode,
    transfer: session.transfer,
    pianoNotes: session.pianoNotes,
    arranger: session.arranger,
    mixer: session.mixer,
  };
}

export function projectAssetIds(session) {
  return [
    ...session.decks.flatMap((deck) => Object.values(deck.lanes).map((lane) => lane.assetId)),
    ...session.pads.map((pad) => pad.assetId),
    ...session.recordings.map((recording) => recording.id),
    ...session.arranger.tracks.flatMap((track) => track.clips.map((clip) => clip.assetId)),
    ...session.arranger.captures.map((capture) => capture.assetId),
    ...performanceAssetIds(session.arranger.captures),
  ];
}

export function projectManifest(session) {
  return {
    schema: 'SattariStudio.project.v5',
    product: 'Sattari Studio',
    sessionName: session.sessionName,
    createdAt: new Date().toISOString(),
    master: {
      bpm: session.masterBpm,
      projectKey: session.projectKey,
      level: session.masterLevel,
      processing: session.masterProcessing,
      crossfader: session.crossfader,
      crossfaderCurve: session.crossfaderCurve,
      crossfaderReverse: session.crossfaderReverse,
      limiter: session.limiter,
      aiMaster: session.aiMaster,
      aiMasterMode: session.aiMasterMode,
    },
    decks: session.decks,
    pads: session.pads,
    recordings: session.recordings,
    pianoNotes: session.pianoNotes,
    arranger: session.arranger,
    mixer: session.mixer,
    source: session.transfer || null,
  };
}
