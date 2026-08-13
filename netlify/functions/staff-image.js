import crypto from 'node:crypto';
import { requireStaff } from '../../server/staffAuth.js';
import { openStore } from '../../server/blobs.js';

export const IMAGE_STORE = 'catalog-images';

// Only formats a browser will render inline. No SVG: it can carry script, and
// these files are served from our own origin.
const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Generous ceiling. The staff page resizes in the browser before uploading, so
// a real photo arrives well under this; the limit is here to stop an oversized
// or hostile upload, not to shape normal use.
const MAX_BYTES = 2 * 1024 * 1024;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

// Verifies the bytes actually are the image type claimed, rather than trusting
// the declared MIME. A mislabelled file would otherwise be stored and served
// back under a content type it does not match.
function sniffType(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.length > 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export async function handler(event) {
  const session = requireStaff(event);
  if (!session) {
    return json(401, { error: 'Sign in to continue.' });
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

  const dataUrl = String(body.dataUrl || '');
  const match = /^data:([a-z/+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    return json(400, { error: 'Send the image as a base64 data URL.' });
  }

  let buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    return json(400, { error: 'That image could not be read.' });
  }

  if (!buffer.length) return json(400, { error: 'That image is empty.' });
  if (buffer.length > MAX_BYTES) {
    return json(413, {
      error: `That image is ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Keep it under 2MB.`,
    });
  }

  const actualType = sniffType(buffer);
  if (!actualType || !ALLOWED[actualType]) {
    return json(400, { error: 'Only JPEG, PNG, and WebP images are accepted.' });
  }

  const key = `${crypto.randomBytes(12).toString('hex')}.${ALLOWED[actualType]}`;

  const store = openStore(event, IMAGE_STORE);
  await store.set(key, buffer, { metadata: { contentType: actualType, staff: session.staff } });

  console.log(
    JSON.stringify({
      type: 'staff-image-upload',
      staff: session.staff,
      key,
      bytes: buffer.length,
    })
  );

  return json(200, { key, url: `/product-images/${key}`, bytes: buffer.length });
}
