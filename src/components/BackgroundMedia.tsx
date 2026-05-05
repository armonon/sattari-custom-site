import { useEffect, useState } from 'react';

declare global {
  interface Navigator {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
  }
}

export default function BackgroundMedia() {
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveDataEnabled = navigator.connection?.saveData;
    const slowConnection = ['slow-2g', '2g'].includes(navigator.connection?.effectiveType || '');
    const isLargeViewport = window.innerWidth >= 860;

    if (prefersReducedMotion || saveDataEnabled || slowConnection || !isLargeViewport) {
      return;
    }

    const startVideo = () => setShowVideo(true);

    if (window.requestIdleCallback) {
      window.requestIdleCallback(startVideo);
      return;
    }

    const timeoutId = window.setTimeout(startVideo, 700);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at top, rgba(21,21,25,0.95), rgba(8,8,9,0.98) 48%), #000',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: 'absolute',
          inset: '10% 10% auto',
          height: '60vh',
          backgroundImage: "url('/sattari site/sattari logo.avif')",
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'min(40vw, 480px)',
          opacity: 0.05,
          filter: 'blur(2px)',
        }}
      />
      {showVideo ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster="/sattari site/sattari logo.avif"
          style={{
            width: '100vw',
            height: '100vh',
            objectFit: 'cover',
            display: 'block',
            background: '#000',
            filter: 'blur(8px)',
            opacity: 0.42,
          }}
        >
          <source src="/sattari site/INSTRA PATTERN.mp4" type="video/mp4" />
        </video>
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.45))',
        }}
      />
    </div>
  );
}
