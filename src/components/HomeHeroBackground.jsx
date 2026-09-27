import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { BACKGROUND_VIDEOS } from './BackgroundMedia';

export default function HomeHeroBackground() {
  const { mode } = useTheme();
  const videoRef = useRef(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failedSource, setFailedSource] = useState('');
  const source = BACKGROUND_VIDEOS[mode];
  const poster = `/images/home/video-${mode}-poster.jpg`;
  const showVideo = motionAllowed && failedSource !== source;

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const updatePreference = () =>
      setMotionAllowed(
        !motion.matches &&
          !connection?.saveData &&
          !['slow-2g', '2g'].includes(connection?.effectiveType)
      );
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
      <div className="home-hero-background" aria-hidden="true">
        <img src={poster} alt="" className="home-hero-poster" decoding="async" />
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
            poster={poster}
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
