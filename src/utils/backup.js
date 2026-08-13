// Snapshots of everything the shop cannot recover from somewhere else.
//
// Orders are deliberately NOT backed up here: Stripe is the system of record
// for payments, and a second copy would only ever be the one that disagrees.
// What is irreplaceable is the shop's own work — stock counts (a physical
// recount), catalog edits, and fulfilment state.

export const BACKUP_STORE = 'backups';
export const BACKUP_PREFIX = 'snapshot/';
export const BACKUP_VERSION = 1;

// About a month of daily snapshots. Enough to notice and undo a bad bulk edit,
// small enough that the store never becomes a cost.
export const KEEP_SNAPSHOTS = 30;

export function snapshotKey(isoString) {
  // Second precision, so a manual snapshot taken minutes before a restore
  // cannot overwrite the night's automatic one.
  const stamp = String(isoString).replace(/[:.]/g, '-').replace(/Z$/, '');
  return `${BACKUP_PREFIX}${stamp}.json`;
}

export function buildSnapshot({ stock, catalog, fulfillment, imageKeys, reason, at }) {
  return {
    version: BACKUP_VERSION,
    createdAt: new Date(at).toISOString(),
    reason: reason || 'scheduled',
    stock: stock || {},
    catalog: catalog || { overrides: {}, added: [], hidden: [] },
    fulfillment: fulfillment || {},
    // Image bytes are not included — a JSON backup of photos would be enormous
    // and blob keys are immutable and never reused, so the list is enough to
    // tell you what should exist and what is missing.
    imageKeys: Array.isArray(imageKeys) ? imageKeys : [],
  };
}

// A snapshot is only useful if a restore can trust it. Anything that fails
// these checks is refused rather than written over live data.
export function validateSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'That backup file is not readable.' };
  }
  if (raw.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `That backup is version ${raw.version ?? 'unknown'}; this system reads version ${BACKUP_VERSION}.`,
    };
  }
  if (!raw.stock || typeof raw.stock !== 'object' || Array.isArray(raw.stock)) {
    return { ok: false, error: 'That backup has no usable stock data.' };
  }
  if (!raw.catalog || typeof raw.catalog !== 'object' || Array.isArray(raw.catalog)) {
    return { ok: false, error: 'That backup has no usable catalog data.' };
  }
  return { ok: true };
}

// Newest first, then everything past the keep count is returned for deletion.
export function selectExpired(keys, keep = KEEP_SNAPSHOTS) {
  const snapshots = keys
    .filter((key) => key.startsWith(BACKUP_PREFIX))
    .sort()
    .reverse();
  return snapshots.slice(keep);
}

export function describeSnapshot(snapshot) {
  const stockCount = Object.keys(snapshot?.stock || {}).length;
  const added = (snapshot?.catalog?.added || []).length;
  const hidden = (snapshot?.catalog?.hidden || []).length;
  const overrides = Object.keys(snapshot?.catalog?.overrides || {}).length;
  const fulfilled = Object.keys(snapshot?.fulfillment || {}).length;

  return {
    createdAt: snapshot?.createdAt || '',
    reason: snapshot?.reason || '',
    trackedVariants: stockCount,
    editedProducts: overrides,
    addedProducts: added,
    hiddenProducts: hidden,
    fulfilledOrders: fulfilled,
    images: (snapshot?.imageKeys || []).length,
  };
}
