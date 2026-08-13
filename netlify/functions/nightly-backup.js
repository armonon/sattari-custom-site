import { KEEP_SNAPSHOTS } from '../../src/utils/backup.js';
import { captureSnapshot, pruneSnapshots, writeSnapshot } from '../../server/backupStore.js';

// Runs on a schedule (see netlify.toml). Cannot be triggered over HTTP, which
// is why the staff-facing download and restore live in staff-backup.js.
//
// Snapshots only what the shop cannot get back from anywhere else. Orders are
// excluded on purpose: Stripe is the system of record for payments, and a
// second copy would only ever be the one that disagrees.
export async function handler() {
  const startedAt = Date.now();

  try {
    const snapshot = await captureSnapshot(null, 'scheduled', startedAt);
    const key = await writeSnapshot(null, snapshot);
    const pruned = await pruneSnapshots(null, KEEP_SNAPSHOTS);

    console.log(
      JSON.stringify({
        type: 'nightly-backup',
        ok: true,
        key,
        trackedVariants: Object.keys(snapshot.stock).length,
        addedProducts: (snapshot.catalog.added || []).length,
        fulfilledOrders: Object.keys(snapshot.fulfillment).length,
        images: snapshot.imageKeys.length,
        pruned,
        ms: Date.now() - startedAt,
      })
    );

    return { statusCode: 200 };
  } catch (error) {
    // Loud on purpose. A backup that quietly stops running is worse than no
    // backup, because it buys false confidence — this shows up in the
    // function log as an error, not a success with a sad message.
    console.error(
      JSON.stringify({
        type: 'nightly-backup',
        ok: false,
        message: error?.message || String(error),
        ms: Date.now() - startedAt,
      })
    );
    throw error;
  }
}
