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

// Both source clips frame a centered *square* of real content:
//  • bg.mp4 (day)   is 1280×720 with ~22% black pillarbox bars on each side,
//    so the content is a 720×720 square in the middle.
//  • the night pattern is a full-frame 1200×1200 square (no bars).
// We give the <video> its own frame aspect ratio and size it from the larger
// viewport axis, so that centered content square always covers the viewport.
// The black pillars then fall outside the overflow-hidden container at every
// aspect ratio — no black border at any size. A little overscan hides the
// blur's soft edges just past the viewport.
const DAY_FRAME_AR = 1280 / 720; // ≈ 1.778
const NIGHT_FRAME_AR = 1; // 1200 × 1200
const COVER_OVERSCAN = 1.12;

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
            position: 'absolute',
            top: '50%',
            left: '50%',
            // Size to the frame's aspect ratio from the larger viewport axis so
            // the centered content square always covers the viewport and the
            // black pillars stay clipped outside it — at any window size.
            height: `calc(max(100vw, 100vh) * ${COVER_OVERSCAN})`,
            width: `calc(max(100vw, 100vh) * ${COVER_OVERSCAN * (isDay ? DAY_FRAME_AR : NIGHT_FRAME_AR)})`,
            transform: 'translate(-50%, -50%)',
            transformOrigin: 'center',
            objectFit: 'cover',
            display: 'block',
            background: isDay ? '#f6f1e6' : '#000',
            filter: isDay ? 'blur(14px) saturate(1.05)' : 'blur(8px)',
            opacity: isDay ? 0.9 : 0.42,
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
            ? 'linear-gradient(180deg, rgba(255,255,255,0.5), rgba(246,241,230,0.62))'
            : 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.45))',
        }}
      />
    </div>
  );
}
