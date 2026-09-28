function toAvifSource(src) {
  // Only the bundled PNGs under /sattari site/ ship an .avif sibling. Others
  // have none: the violin photos are .jpg, and a PNG staff uploaded is served
  // by /product-images/, which has no .avif to give (a <source> pointing there
  // left the image blank). The browser loads those rasters directly.
  if (!src || !/^\/sattari site\/.+\.png$/i.test(src)) return null;
  // srcset splits candidates on spaces, so "/sattari site/x.avif" was read as
  // the URL "/sattari" and dropped, and the PNG always loaded instead.
  return src.replace(/\.png$/i, '.avif').replace(/ /g, '%20');
}

export default function OptimizedProductImage({
  src,
  alt,
  className,
  loading = 'lazy',
  // Lowercase on purpose: React 18 does not know the camelCase fetchPriority
  // prop and warns, while an unknown lowercase attribute passes straight
  // through to the HTML (prerendered and client alike).
  fetchpriority = 'auto',
  sizes = '100vw',
}) {
  if (!src) return null;

  const avifSrc = toAvifSource(src);

  return (
    <picture>
      {avifSrc ? <source srcSet={avifSrc} type="image/avif" sizes={sizes} /> : null}
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        // See the prop above.
        // eslint-disable-next-line react/no-unknown-property
        fetchpriority={fetchpriority}
        decoding="async"
      />
    </picture>
  );
}
