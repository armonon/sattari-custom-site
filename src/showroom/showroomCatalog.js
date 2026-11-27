// Each display is bound to an existing product, never a separate price or stock record.
export const GUITAR_DISPLAYS = [
  { slug: 'flame-stratocaster-electric-guitar', kind: 'electric', label: 'Electric', x: -1.88 },
  { slug: 'five-string-bass-guitar', kind: 'bass', label: 'Bass', x: -0.94 },
  { slug: 'classic-nylon-string-guitar', kind: 'classical', label: 'Classical', x: 0.47 },
  { slug: 'steel-string-acoustic-guitar', kind: 'steel', label: 'Acoustic', x: 1.88 },
];

// Prefer the product's authored specification list. Where that list is empty,
// surface only facts explicitly stated in the current catalog name/description.
// In particular, the electric guitar's generic marketing copy does not verify
// wood species, pickups, hardware, string count, or available finish options.
const DESCRIPTION_SPECS = {
  electric: [[/\belectric\s+guitar\b/i, 'Instrument: electric guitar']],
  bass: [
    [/\belectric\s+bass\b/i, 'Instrument: electric bass'],
    [/\b(?:five|5)[\s-]+string\b/i, 'Strings: 5'],
    [/\bglossy\s+finish\b/i, 'Finish: gloss'],
  ],
  classical: [[/\bnylon[\s-]+string\b/i, 'Strings: nylon']],
  steel: [
    [/\bacoustic\s+guitar\b/i, 'Instrument: acoustic guitar'],
    [/\bsteel[\s-]+string\b/i, 'Strings: steel'],
  ],
};

function specificationsFor(product, kind) {
  const authored = Array.isArray(product.specs)
    ? product.specs
        .filter((spec) => typeof spec === 'string' && spec.trim())
        .map((spec) => spec.trim())
    : [];
  if (authored.length) return [...new Set(authored)];
  const description = [product.name, product.description]
    .filter((value) => typeof value === 'string')
    .join(' ');
  return (DESCRIPTION_SPECS[kind] || []).flatMap(([pattern, spec]) =>
    pattern.test(description) ? [spec] : []
  );
}

export function showroomProducts(products) {
  return GUITAR_DISPLAYS.flatMap((display) => {
    const product = products.find((item) => item.slug === display.slug);
    return product
      ? [{ ...display, product, specs: specificationsFor(product, display.kind) }]
      : [];
  });
}
