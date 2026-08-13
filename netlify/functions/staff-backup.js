import { describeSnapshot, validateSnapshot } from '../../src/utils/backup.js';
import {
  captureSnapshot,
  listSnapshots,
  readSnapshot,
  restoreSnapshot,
  writeSnapshot,
} from '../../server/backupStore.js';
import { requireStaff } from '../../server/staffAuth.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  const session = requireStaff(event);
  if (!session) {
    return json(401, { error: 'Sign in to continue.' });
  }

  // --- read --------------------------------------------------------------
  if (event.httpMethod === 'GET') {
    const action = event.queryStringParameters?.action || 'list';

    // A snapshot of right now, streamed straight to the browser as a file.
    // This is the copy that survives losing the Netlify account, which the
    // stored snapshots do not — they live in the same place as the data.
    if (action === 'download') {
      const key = event.queryStringParameters?.key;
      const snapshot = key
        ? await readSnapshot(event, key)
        : await captureSnapshot(event, `manual by ${session.staff}`);

      if (!snapshot) return json(404, { error: 'That backup no longer exists.' });

      const stamp = (snapshot.createdAt || '').slice(0, 19).replace(/[:T]/g, '-');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="sattari-backup-${stamp}.json"`,
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify(snapshot, null, 2),
      };
    }

    const keys = await listSnapshots(event);
    const recent = [];
    for (const key of keys.slice(0, 30)) {
      const snapshot = await readSnapshot(event, key).catch(() => null);
      if (snapshot) recent.push({ key, ...describeSnapshot(snapshot) });
    }

    return json(200, { staff: session.staff, snapshots: recent, total: keys.length });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  // --- take a snapshot now ------------------------------------------------
  if (body.action === 'snapshot') {
    const snapshot = await captureSnapshot(event, `manual by ${session.staff}`);
    const key = await writeSnapshot(event, snapshot);
    console.log(JSON.stringify({ type: 'staff-backup-snapshot', staff: session.staff, key }));
    return json(200, { staff: session.staff, key, summary: describeSnapshot(snapshot) });
  }

  // --- restore ------------------------------------------------------------
  if (body.action === 'restore') {
    const key = String(body.key || '');
    if (!key) return json(400, { error: 'Which backup?' });

    // Typing the word is the guard. A restore silently overwrites live stock,
    // prices, and fulfilment, so it must not be reachable by a stray click.
    if (body.confirm !== 'RESTORE') {
      return json(400, { error: 'Type RESTORE to confirm. Nothing was changed.' });
    }

    const snapshot = await readSnapshot(event, key);
    if (!snapshot) return json(404, { error: 'That backup no longer exists.' });

    const check = validateSnapshot(snapshot);
    if (!check.ok) return json(400, { error: check.error });

    // Snapshot the CURRENT state first, so restoring the wrong backup is
    // itself undoable. A restore you cannot walk back is not a safety net.
    const safety = await captureSnapshot(event, `before restore by ${session.staff}`);
    const safetyKey = await writeSnapshot(event, safety);

    await restoreSnapshot(event, snapshot);

    console.log(
      JSON.stringify({
        type: 'staff-backup-restore',
        staff: session.staff,
        restored: key,
        safetyKey,
      })
    );

    return json(200, {
      staff: session.staff,
      restored: key,
      safetyKey,
      summary: describeSnapshot(snapshot),
    });
  }

  return json(400, { error: 'Unknown action.' });
}
