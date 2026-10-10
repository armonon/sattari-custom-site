export const LIBRARY_DRAG_TYPE = 'application/x-sattari-library-track';
export function readBlob(blob) {
  if (blob.arrayBuffer) return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

// Versioned tree hash: bounded 1 MiB reads, not a decoded song-sized buffer.
export async function hashLibraryAudio(blob) {
  if (!crypto.subtle)
    throw new Error('Secure audio import is unavailable. Use HTTPS or localhost.');
  const parts = [];
  for (let offset = 0; offset < blob.size; offset += 1048576) {
    const expected = Math.min(1048576, blob.size - offset);
    const bytes = await readBlob(blob.slice(offset, offset + expected));
    if (bytes.byteLength !== expected)
      throw new Error('Audio storage returned an invalid byte range.');
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
    parts.push(...new Uint8Array(digest));
  }
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(parts));
  return `audio-tree-v1:${blob.size}:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
