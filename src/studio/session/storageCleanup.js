import { deleteAudioAssets, unusedAudioAssets } from '../../utils/audioProjectStore';
import { clearExportFile, savedExportFiles } from '../../utils/arrangementStreamExport';
import { journalStore } from '../../utils/performanceJournal';
import { performanceAssetIds } from '../../utils/performanceReplay';
import { projectAssetIds } from './sessionSnapshot';

// The Learn page hands audio to the Studio through this key; until the Studio
// takes the transfer, its asset is referenced only here.
const TRANSFER_KEY = 'sattari-studio-transfer-v1';

function pendingTransferAsset() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(TRANSFER_KEY) || 'null')?.audioAssetId;
  } catch {
    return null;
  }
}

/**
 * What a cleanup would remove. Recovery copies of takes that are already
 * saved in the project go; takes only the recovery journal knows about stay,
 * with their audio. Audio is removed only when nothing references it.
 */
// Every open Studio tab holds this shared lock. Another tab may have a
// different project whose audio this tab cannot see, so cleanup refuses to
// run while more than one Studio tab holds it.
const STUDIO_TAB_LOCK = 'sattari-studio-tab';

export function holdStudioTabLock() {
  const locks = globalThis.navigator?.locks;
  if (!locks?.request) return () => {};
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  locks.request(STUDIO_TAB_LOCK, { mode: 'shared' }, () => held).catch(() => {});
  return () => release();
}

/** True when another Studio tab is open; unknown (no Web Locks) counts as none. */
export async function otherStudioTabsOpen() {
  try {
    const snapshot = await globalThis.navigator?.locks?.query?.();
    const holders = (snapshot?.held || []).filter((lock) => lock.name === STUDIO_TAB_LOCK);
    return holders.length > 1;
  } catch {
    return false;
  }
}

const GRACE_MS = 60 * 60 * 1000;

// Temporary export and backup copies not written in the last hour (a download
// may still be reading a newer one), except files the caller keeps.
async function oldExportFiles(keepFiles, now) {
  const keep = new Set(keepFiles.filter(Boolean));
  try {
    return (await savedExportFiles()).filter(
      (file) => !keep.has(file.name) && !(file.lastModified > now - GRACE_MS)
    );
  } catch {
    return [];
  }
}

export async function planStorageCleanup(
  session,
  { journal = journalStore, keepFiles = [], now = Date.now() } = {}
) {
  const captures = session.arranger?.captures || [];
  const savedTakes = new Set(captures.map((capture) => capture.id).filter(Boolean));
  const savedCaptures = new Set(captures.map((capture) => capture.sourceCaptureId).filter(Boolean));
  const inventory = await journal.inventory();
  const keptTakes = inventory.takes.filter((take) => !savedTakes.has(take.id));
  const keptCaptures = inventory.captures.filter((capture) => !savedCaptures.has(capture.id));
  const referenced = [
    ...projectAssetIds(session),
    // Damaged parts set aside on restore keep their audio until discarded.
    ...performanceAssetIds(session.arranger?.setAside || []),
    session.transfer?.audioAssetId,
    pendingTransferAsset(),
    ...keptTakes.map((take) => take.assetId),
    ...keptCaptures.flatMap((capture) => capture.assetIds),
  ].filter(Boolean);
  const unused = await unusedAudioAssets(referenced, { graceMs: GRACE_MS, now });
  const exports = await oldExportFiles(keepFiles, now);
  const redundantTakes = inventory.takes.filter((take) => savedTakes.has(take.id));
  return {
    unused,
    bytes: unused.reduce((sum, asset) => sum + (asset.size || 0), 0),
    exports,
    exportBytes: exports.reduce((sum, file) => sum + file.size, 0),
    takeIds: redundantTakes.map((take) => take.id),
    captureIds: inventory.captures
      .filter((capture) => savedCaptures.has(capture.id))
      .map((capture) => capture.id),
    events: redundantTakes.reduce((sum, take) => sum + take.events, 0),
  };
}

export async function runStorageCleanup(plan, { journal = journalStore } = {}) {
  await journal.discard({ takeIds: plan.takeIds, captureIds: plan.captureIds });
  await deleteAudioAssets(plan.unused.map((asset) => asset.id));
  for (const file of plan.exports || []) await clearExportFile(file).catch(() => {});
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(0.1, bytes / 1024 ** 2).toFixed(1)} MB`;
}
