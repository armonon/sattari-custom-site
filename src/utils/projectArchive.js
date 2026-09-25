import { getAudioAsset, validateStudioProject } from './audioProjectStore';
import { createExportSink } from './arrangementStreamExport';
import { hashLibraryAudio } from './libraryFiles';

const MAGIC = 'SATPROJ6';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_MANIFEST = 64 * 1024 * 1024;

// Binary assets are copied to temporary disk in 1 MiB pieces, never base64
// encoded. Existing v2-v5 JSON projects remain readable.
export async function writeProjectArchive(manifest, ids, progress = () => {}) {
  const assets = [];
  for (const id of new Set(ids.filter(Boolean))) {
    const asset = await getAudioAsset(id);
    if (!asset?.blob) throw new Error(`Project audio is missing (${id}). Relink it before saving.`);
    const { blob, ...metadata } = asset;
    assets.push({ ...metadata, size: blob.size, hash: await hashLibraryAudio(blob) });
  }
  const header = encoder.encode(
    JSON.stringify({ ...manifest, schema: 'SattariStudio.project.v6', assets })
  );
  if (header.length > MAX_MANIFEST)
    throw new Error(
      'Project metadata exceeds 64 MiB. Split this project before making a portable archive.'
    );
  const prefix = new Uint8Array(12);
  prefix.set(encoder.encode(MAGIC));
  new DataView(prefix.buffer).setUint32(8, header.length, true);
  const sink = await createExportSink(
    12 + header.length + assets.reduce((sum, a) => sum + a.size, 0),
    'sattari'
  );
  try {
    await sink.write(prefix);
    await sink.write(header);
    for (const [index, metadata] of assets.entries()) {
      progress(`Saving audio ${index + 1} / ${assets.length}`);
      const asset = await getAudioAsset(metadata.id);
      if (!asset?.blob || asset.blob.size !== metadata.size)
        throw new Error('Project audio changed during backup. Please retry.');
      for (let at = 0; at < asset.blob.size; at += 1024 * 1024)
        await sink.write(
          new Uint8Array(await asset.blob.slice(at, at + 1024 * 1024).arrayBuffer())
        );
    }
    return await sink.finish();
  } catch (error) {
    await sink.abort();
    throw error;
  }
}

export async function readProjectArchive(file) {
  const prefix = await file.slice(0, 12).arrayBuffer();
  if (prefix.byteLength < 12 || decoder.decode(new Uint8Array(prefix, 0, 8)) !== MAGIC) {
    if (file.size > 256 * 1024 * 1024)
      throw new Error(
        'Legacy JSON project exceeds the safe import budget. Open it with its original version and save a binary project.'
      );
    return JSON.parse(await file.text());
  }
  const length = new DataView(prefix).getUint32(8, true);
  if (!length || length > MAX_MANIFEST || 12 + length > file.size)
    throw new Error('Damaged project header.');
  const manifest = JSON.parse(await file.slice(12, 12 + length).text());
  if (manifest.schema !== 'SattariStudio.project.v6' || !Array.isArray(manifest.assets))
    throw new Error('Unsupported project archive.');
  validateStudioProject(manifest);
  let offset = 12 + length;
  const ids = new Set();
  manifest.assets = manifest.assets.map((asset) => {
    if (
      !asset ||
      typeof asset.id !== 'string' ||
      !asset.id ||
      ids.has(asset.id) ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 0 ||
      asset.size > file.size - offset
    )
      throw new Error('Damaged project audio index.');
    ids.add(asset.id);
    const blob = file.slice(
      offset,
      offset + asset.size,
      typeof asset.type === 'string' ? asset.type : 'audio/wav'
    );
    offset += asset.size;
    return { ...asset, blob };
  });
  if (offset !== file.size) throw new Error('Unexpected data after project audio.');
  for (const asset of manifest.assets)
    if (asset.hash !== (await hashLibraryAudio(asset.blob)))
      throw new Error(`Project audio is damaged: ${asset.name || asset.id}. Nothing was imported.`);
  return manifest;
}
