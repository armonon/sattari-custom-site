function toAvifSource(src) {
  // Only the bundled drum PNGs ship an .avif sibling. Other images (e.g. the
  // violin photos saved as .jpg) have no .avif, so skip the <source> for them
  // to avoid a broken avif reference — the browser loads the raster directly.
  if (!src || !/\.png$/i.test(src)) return null;
  return src.replace(/\.png$/i, '.avif');
}

export default function OptimizedProductImage({
  src,
  alt,
  className,
  loading = 'lazy',
  fetchPriority = 'auto',
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
        fetchPriority={fetchPriority}
        decoding="async"
      />
    </picture>
  );
}
