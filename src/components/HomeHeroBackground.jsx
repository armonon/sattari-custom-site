import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { BACKGROUND_VIDEOS, COMPACT_BACKGROUND_VIDEOS } from './BackgroundMedia';

// Phones (either orientation) get the lighter loops.
const isCompactViewport = () => window.innerWidth <= 760 || window.innerHeight <= 500;

export default function HomeHeroBackground() {
  // `mode` is a placeholder until `ready` (see ThemeContext): the video waits
  // for it, so a day visitor never starts the night loop.
  const { mode, ready } = useTheme();
  const videoRef = useRef(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [compact, setCompact] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failedSource, setFailedSource] = useState('');
  const source = (compact ? COMPACT_BACKGROUND_VIDEOS : BACKGROUND_VIDEOS)[mode];
  const showVideo = ready && motionAllowed && failedSource !== source;

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const updatePreference = () =>
      setMotionAllowed(
        !motion.matches &&
          !connection?.saveData &&
          !['slow-2g', '2g'].includes(connection?.effectiveType)
      );
    setCompact(isCompactViewport());
    updatePreference();
    motion.addEventListener('change', updatePreference);
    connection?.addEventListener?.('change', updatePreference);
    return () => {
      motion.removeEventListener('change', updatePreference);
      connection?.removeEventListener?.('change', updatePreference);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    let disposed = false;
    let inView = video.getBoundingClientRect().bottom > 0;
    const shouldPlay = () => !disposed && !paused && inView && !document.hidden;
    const syncPlayback = () => {
      if (!shouldPlay()) {
        video.pause();
        return;
      }
      Promise.resolve(video.play())
        .then(() => {
          if (!shouldPlay()) video.pause();
        })
        .catch(() => {
          if (shouldPlay()) setPaused(true);
        });
    };
    // Stop decoding the decorative loop while the hero or tab is out of view.
    const observer = window.IntersectionObserver
      ? new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          syncPlayback();
        })
      : null;
    observer?.observe(video);
    document.addEventListener('visibilitychange', syncPlayback);
    syncPlayback();
    return () => {
      disposed = true;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
      video.pause();
    };
  }, [showVideo, source, paused]);

  return (
    <>
      {/* The still is this element's CSS background, chosen by <html data-theme>
          (HomePage.css): right before the app loads, since the prerender cannot
          know the visitor's theme, and only that theme's still is fetched.
          index.html preloads the same URL, which every browser reuses for a
          background (Safari does not for a lazy <img>, so it downloaded twice).
          The video has no poster of its own: until its first frame it is
          transparent and this still shows through, without a second request. */}
      <div className="home-hero-background" aria-hidden="true">
        {showVideo && (
          <video
            key={source}
            ref={videoRef}
            className="home-hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setFailedSource(source)}
          >
            <source src={source} type="video/mp4" onError={() => setFailedSource(source)} />
          </video>
        )}
      </div>
      {showVideo && (
        <button
          type="button"
          className="home-hero-motion"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? 'Play background video' : 'Pause background video'}
          title={paused ? 'Play background video' : 'Pause background video'}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      )}
    </>
  );
}
