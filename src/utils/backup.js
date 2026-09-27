// Snapshots of everything the shop cannot recover from somewhere else.
//
// Orders are deliberately NOT backed up here: Stripe is the system of record
// for payments, and a second copy would only ever be the one that disagrees.
// What is irreplaceable is the shop's own work — stock counts (a physical
// recount), catalog edits, and fulfilment state.

import { HOLDS_FIELD, reservedQuantities, sanitizeHolds, sanitizeStockMap } from './inventory.js';

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

export function buildSnapshot({ stock, stockSales, catalog, fulfillment, imageKeys, reason, at }) {
  return {
    version: BACKUP_VERSION,
    createdAt: new Date(at).toISOString(),
    reason: reason || 'scheduled',
    stock: stock || {},
    // Sales already reflected in `stock`, read from the same blob in the same
    // read. Lets a restore tell exactly which later sales it must subtract.
    stockSales: Array.isArray(stockSales) ? stockSales : [],
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

// Splits the raw stock blob into the counts a snapshot keeps and the ids of
// sales it already reflects. Open checkout holds are not kept: they belong to
// live Stripe sessions and mean nothing once those sessions are gone.
export function splitStockForSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { stock: raw, stockSales: [] };

  const { [HOLDS_FIELD]: rawHolds, ...stock } = raw;
  const holds = sanitizeHolds(rawHolds);
  return {
    stock,
    stockSales: Object.keys(holds).filter((id) => holds[id].state === 'sold'),
  };
}

// Clock skew between two functions is far below this, and a sale inside the
// margin that the snapshot already reflects is named in its stockSales.
const SALE_BOUNDARY_MARGIN_MS = 10 * 60 * 1000;

// Restored counts = the snapshot's counts minus every sale that came out of
// stock after the snapshot was taken. Restoring the counts as they were would
// put those sold units back on sale.
//
// Recent sales are read from the sold markers in the live stock document
// (`live`), which are written in the same write as the decrement, so a sale
// landing while the restore runs is caught. Older ones, whose markers have
// been pruned, come from the order records. Orders recorded before orders kept
// their stock lines cannot be attributed to a variant and are listed instead.
export function reconcileRestoredStock({ snapshot, live, orders = [], now = Date.now() }) {
  const takenAt = Date.parse(snapshot?.createdAt);
  const known = Array.isArray(snapshot?.stockSales) ? new Set(snapshot.stockSales) : null;
  const since = known ? takenAt - SALE_BOUNDARY_MARGIN_MS : takenAt;
  const soldAfterSnapshot = (holdId, at) =>
    Number.isFinite(at) && at > since && !(known && known.has(holdId));

  const sales = new Map();
  for (const [holdId, hold] of Object.entries(live.holds || {})) {
    const at = Number(hold.soldAt);
    if (hold.state === 'sold' && soldAfterSnapshot(holdId, at)) {
      sales.set(holdId, { orderId: hold.sessionId || holdId, at, lines: hold.lines });
    }
  }

  const unreconciledOrders = [];
  for (const order of orders) {
    if (order?.stock) {
      const holdId = order.stock.holdId;
      const at = Date.parse(order.stock.appliedAt);
      if (order.stock.state !== 'applied' || sales.has(holdId)) continue;
      if (soldAfterSnapshot(holdId, at)) {
        sales.set(holdId, { orderId: order.id, at, lines: order.stock.applied || [] });
      }
    } else if (order?.paymentStatus === 'paid' && Date.parse(order.recordedAt) > takenAt) {
      unreconciledOrders.push({ orderId: order.id, recordedAt: order.recordedAt });
    }
  }

  const stock = sanitizeStockMap(snapshot?.stock);
  const sold = {};
  for (const sale of sales.values()) {
    for (const line of sale.lines || []) {
      if (!Object.prototype.hasOwnProperty.call(stock, line.key)) continue;
      sold[line.key] = (sold[line.key] || 0) + (Number(line.quantity) || 0);
    }
  }

  const adjusted = [];
  for (const [key, quantity] of Object.entries(sold)) {
    const restored = Math.max(0, stock[key] - quantity);
    adjusted.push({ key, backup: stock[key], soldSince: quantity, restored });
    stock[key] = restored;
  }

  // Open checkouts keep their reservations across a restore. Where they now
  // exceed the restored count, those checkouts will be flagged oversold if paid.
  const held = Object.entries(reservedQuantities(live.holds, now))
    .filter(([key]) => Object.prototype.hasOwnProperty.call(stock, key))
    .map(([key, quantity]) => ({
      key,
      held: quantity,
      restored: stock[key],
      short: quantity > stock[key],
    }));

  return {
    stock,
    report: {
      backupTakenAt: snapshot?.createdAt || '',
      salesSinceBackup: [...sales.values()].map(({ orderId, at }) => ({
        orderId,
        soldAt: new Date(at).toISOString(),
      })),
      adjusted,
      held,
      unreconciledOrders,
    },
  };
}

// Restored fulfilment = the backup's entries, except where the live entry is
// the only record of what the shop did. An order placed after the backup, or
// one the backup holds no entry for, keeps its live entry: writing the backup
// over it would send a packed or shipped order back to "new", to be packed and
// shipped a second time. `kept` lists every live entry left in place.
export function reconcileRestoredFulfillment({ snapshot, live = {}, orders = [] }) {
  const takenAt = Date.parse(snapshot?.createdAt);
  const backup =
    snapshot?.fulfillment && typeof snapshot.fulfillment === 'object' ? snapshot.fulfillment : {};
  const placedAfterBackup = new Set(
    orders
      .filter((order) => Date.parse(order?.recordedAt || order?.submittedAt) > takenAt)
      .map((order) => order.id)
  );

  const doc = { ...backup };
  const kept = [];
  for (const [orderId, entry] of Object.entries(live || {})) {
    const reason = placedAfterBackup.has(orderId)
      ? 'placed_after_backup'
      : Object.prototype.hasOwnProperty.call(backup, orderId)
        ? null
        : 'not_in_backup';
    if (!reason) continue;
    doc[orderId] = entry;
    kept.push({ orderId, status: entry?.status || 'new', reason });
  }

  return { doc, kept };
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
