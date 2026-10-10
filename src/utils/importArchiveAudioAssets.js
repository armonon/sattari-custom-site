import { importAudioAssets } from './audioProjectStore';
import { createExportSink, clearExportFile } from './arrangementStreamExport';
import { hashLibraryAudio, readBlob } from './libraryFiles';

const CHUNK = 1024 * 1024;
const MEMORY_BUDGET = 32 * CHUNK;

// A File.slice can lose its backing range when WebKit clones a large portable
// archive into IndexedDB. Stage independent files, not new Blob([slice]) views.
// The fallback limit is aggregate across this import, not a per-asset promise.
export async function importArchiveAudioAssets(records = []) {
  const total = records.reduce((sum, record) => sum + (record.blob?.size ?? NaN), 0);
  if (!Number.isSafeInteger(total) || total < 0)
    throw new Error('Project contains invalid audio sizes.');
  const staged = [];
  try {
    for (const record of records) {
      const sink = await createExportSink(record.blob.size, 'wav', {
        allowMemoryFallback: total <= MEMORY_BUDGET,
      });
      try {
        for (let at = 0; at < record.blob.size; at += CHUNK) {
          const expected = Math.min(CHUNK, record.blob.size - at);
          const bytes = await readBlob(record.blob.slice(at, at + expected));
          if (bytes.byteLength !== expected)
            throw new Error('Project audio returned an invalid byte range. Nothing was imported.');
          await sink.write(new Uint8Array(bytes));
        }
        const blob = await sink.finish();
        if (record.hash !== (await hashLibraryAudio(blob)))
          throw new Error('Project audio copy failed verification. Nothing was imported.');
        staged.push({ ...record, blob });
      } catch (error) {
        await sink.abort().catch(() => {});
        throw error;
      }
    }
    // All files are prepared and verified before the existing atomic batch write.
    return await importAudioAssets(staged, { verifyHashes: true });
  } finally {
    for (const { blob } of staged) {
      try {
        await clearExportFile(blob);
      } catch (error) {
        // Cleanup is not an import failure. Attempt every owned file and keep
        // the primary result; remaining files are listed by savedExportFiles.
        if (error.name !== 'NotFoundError')
          console.warn('Temporary project audio cleanup failed.', error);
      }
    }
  }
}
