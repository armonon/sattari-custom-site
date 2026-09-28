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

export const BACKGROUND_VIDEOS = {
  day: '/sattari site/bg.mp4',
  night: '/sattari site/INSTRA PATTERN.mp4',
};

// Lighter loops for phones. The night loop is 4.8 MB at 1200×1200; this 720×720
// encode (no audio track) looks the same behind the homepage hero.
export const COMPACT_BACKGROUND_VIDEOS = {
  day: BACKGROUND_VIDEOS.day,
  night: '/images/home/night-loop-720.mp4',
};

// The colors (gradients, watermark, video treatment and frosted glass) live in
// styles-theme.css, keyed on <html data-theme>. Choosing them here from `mode`
// put the prerender's guess in inline styles, which painted light text on a
// cream background for dark-mode visitors until the app loaded.
export default function BackgroundMedia() {
  // `mode` is a placeholder until `ready`; the loop waits so it loads once.
  const { mode, ready } = useTheme();
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
    <div className="background-media" aria-hidden="true">
      {/* Faint watermark — night only; in day the video is the backdrop. */}
      <div className="background-media-watermark" />
      {/* Ambient loop: bg.mp4 by day, the pattern loop by night. It starts after
          mount, when `mode` is the visitor's; keyed by mode so the element
          reloads the correct source when the theme flips. */}
      {showVideo && ready ? (
        <video
          key={mode}
          className="background-media-video"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster="/sattari site/sattari logo.avif"
        >
          <source src={BACKGROUND_VIDEOS[mode]} type="video/mp4" />
        </video>
      ) : null}
      {/* Frosted "gaussian glass" over the video so content stays readable. */}
      <div className="background-media-glass" />
    </div>
  );
}
