// Custom caption fonts: accept an uploaded TTF/OTF/WOFF/WOFF2 (e.g. a font
// exported from Glyph Studio), load it with the FontFace API, and register it
// as a selectable font family. Falls back to a safe system stack otherwise.

const FALLBACK_STACK = '"Inter", "Helvetica Neue", Arial, system-ui, sans-serif';

/** Derives a safe, unique-enough CSS font-family name from an uploaded filename. */
export function safeFontFamilyName(filename) {
  const base = String(filename || 'custom')
    .replace(/\.[^./\\]+$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `lyric-font-${base || 'custom'}`;
}

/** The CSS font-family stack to apply, preferring a loaded custom font when given. */
export function fontFamilyStack(customFamilyName) {
  return customFamilyName ? `"${customFamilyName}", ${FALLBACK_STACK}` : FALLBACK_STACK;
}

/**
 * Loads an uploaded font file via the FontFace API and registers it with
 * `document.fonts`. Browser-only (FontFace is not available under jsdom);
 * covered by a Playwright smoke test rather than a unit test.
 * @returns {Promise<string>} the registered CSS font-family name
 */
export async function loadCustomFont(file) {
  if (!file) throw new Error('No font file provided.');
  if (typeof FontFace === 'undefined') {
    throw new Error('Custom fonts are not supported in this browser.');
  }
  const familyName = safeFontFamilyName(file.name);
  const buffer = await file.arrayBuffer();
  const face = new FontFace(familyName, buffer);
  await face.load();
  document.fonts.add(face);
  return familyName;
}
