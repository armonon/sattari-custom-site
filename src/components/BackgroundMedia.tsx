import { useEffect, useState } from 'react';
import { useTheme } from '@context/ThemeContext';

declare global {
  interface Navigator {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
  }
}

const DAY_VIDEO = '/sattari site/bg.mp4';
const NIGHT_VIDEO = '/sattari site/INSTRA PATTERN.mp4';

export default function BackgroundMedia() {
  const { mode } = useTheme();
  const isDay = mode === 'day';
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
        transition: 'background 400ms ease',
        background: isDay
          ? 'radial-gradient(circle at top, rgba(255,252,245,0.98), rgba(240,233,219,0.98) 55%), #f6f1e6'
          : 'radial-gradient(circle at top, rgba(21,21,25,0.95), rgba(8,8,9,0.98) 48%), #000',
      }}
      aria-hidden="true"
    >
      {/* Faint watermark — night only; in day the video is the backdrop. */}
      {!isDay ? (
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
      ) : null}
      {/* Ambient loop: bg.mp4 by day, the pattern loop by night. Keyed by mode
          so the element reloads the correct source when the theme flips. */}
      {showVideo ? (
        <video
          key={mode}
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
            background: isDay ? '#f6f1e6' : '#000',
            filter: isDay ? 'blur(10px) saturate(1.05)' : 'blur(8px)',
            opacity: isDay ? 0.92 : 0.42,
          }}
        >
          <source src={isDay ? DAY_VIDEO : NIGHT_VIDEO} type="video/mp4" />
        </video>
      ) : null}
      {/* Frosted "gaussian glass" over the video so content stays readable. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isDay
            ? 'linear-gradient(180deg, rgba(255,255,255,0.42), rgba(246,241,230,0.55))'
            : 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.45))',
          backdropFilter: isDay ? 'blur(8px)' : undefined,
        }}
      />
    </div>
  );
}
