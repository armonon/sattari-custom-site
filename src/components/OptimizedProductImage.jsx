function toAvifSource(src) {
  if (!src) return null;
  return src.replace(/\.(png|jpe?g)$/i, '.avif');
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
