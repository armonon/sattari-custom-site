import { KEEP_SNAPSHOTS, KEEP_STAFF_SNAPSHOTS } from '../../src/utils/backup.js';
import { captureSnapshot, pruneSnapshots, writeSnapshot } from '../../server/backupStore.js';
import { pruneInquiries } from '../../server/inquiryStore.js';

// Nightly at 09:00 UTC (01:00/02:00 in Los Angeles). A v2 scheduled function:
// the runtime hands it the Blobs context itself, which the Lambda-style version
// never received. Scheduled functions run on published production deploys
// only and cannot be triggered over HTTP, which is why the staff-facing
// download and restore live in staff-backup.js.
export const config = { schedule: '0 9 * * *' };

// Snapshots only what the shop cannot get back from anywhere else. Orders are
// excluded on purpose: Stripe is the system of record for payments, and a
// second copy would only ever be the one that disagrees.
//
// Also the nightly housekeeping for service inquiries (retention and the
// storage ceiling), kept out of the public form's request.
export default async function nightlyBackup() {
  const startedAt = Date.now();
  let failure = null;

  try {
    const snapshot = await captureSnapshot(undefined, 'scheduled', startedAt, 'scheduled');
    const key = await writeSnapshot(undefined, snapshot);
    const pruned = await pruneSnapshots(undefined, KEEP_SNAPSHOTS, KEEP_STAFF_SNAPSHOTS);

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
  } catch (error) {
    // Loud on purpose. A backup that quietly stops running is worse than no
    // backup, because it buys false confidence — this shows up in the
    // function log as an error, not a success with a sad message. Nothing is
    // written when a store could not be read: a partial snapshot would look
    // like a good one and restore as data loss.
    console.error(
      JSON.stringify({
        type: 'nightly-backup',
        ok: false,
        message: error?.message || String(error),
        ms: Date.now() - startedAt,
      })
    );
    failure = error;
  }

  // Runs whether or not the backup worked; a failure here is logged, not
  // thrown, and whatever it left is pruned the next night.
  try {
    const removed = await pruneInquiries(undefined);
    if (removed) console.log(JSON.stringify({ type: 'inquiry-prune', removed }));
  } catch (error) {
    console.error(JSON.stringify({ type: 'inquiry-prune', ok: false, message: error?.message }));
  }

  if (failure) throw failure;
}
