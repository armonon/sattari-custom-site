import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import media from '../data/localGalleryMedia.json';
import { galleryCaptions } from '../data/localGalleryCaptions';
import './HomeLocalGallery.css';

const slides = media
  .map((item, index) => ({
    ...item,
    title: galleryCaptions[index][0],
    alt: galleryCaptions[index][1],
  }))
  .filter((item) => item.id !== 'owner-57');
const fallbackPhoto = '/sattari site/MO.avif';

function GallerySlide({
  slide,
  active,
  playing,
  muted,
  failed,
  onFailed,
  onReady,
  onEnded,
  onBlocked,
}) {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const photo = failed && !slide.video ? fallbackPhoto : slide.poster || slide.src;

  useEffect(() => {
    if (active && ready) onReady(slide.src);
  }, [active, ready, onReady, slide.src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    let disposed = false;
    if (active && playing) {
      if (video.ended) video.currentTime = 0;
      Promise.resolve(video.play()).catch(() => {
        if (!disposed) onBlocked();
      });
    } else video.pause();
    return () => {
      disposed = true;
      video.pause();
    };
  }, [active, playing, failed, onBlocked]);

  return (
    <div
      className={`home-local-gallery-slide ${active ? 'is-current' : 'is-previous'} ${ready ? 'is-ready' : ''}`}
      aria-hidden={!active}
    >
      <img
        src={photo}
        alt={slide.video ? '' : failed ? 'Mohammad Sattari performing on drums.' : slide.alt}
        width={slide.width}
        height={slide.height}
        loading="lazy"
        decoding="async"
        onLoad={() => setReady(true)}
        onError={(event) => {
          if (event.currentTarget.getAttribute('src') !== fallbackPhoto) {
            event.currentTarget.src = fallbackPhoto;
            onFailed(slide.src);
          } else setReady(true);
        }}
      />
      {slide.video && !failed && (
        <video
          ref={videoRef}
          src={slide.src}
          poster={slide.poster}
          muted={!active || muted}
          playsInline
          preload="none"
          aria-label={slide.alt}
          onLoadedData={() => setReady(true)}
          onEnded={() => {
            if (active && playing) onEnded(1);
          }}
          onError={() => onFailed(slide.src)}
        />
      )}
    </div>
  );
}

export default function HomeLocalGallery() {
  const galleryRef = useRef(null);
  const thumbnailsRef = useRef(null);
  const touchStart = useRef(null);
  const playbackIntent = useRef(null);
  const [{ index, previous }, setPosition] = useState({ index: 0, previous: null });
  const [readySource, setReadySource] = useState(null);
  const [paused, setPaused] = useState(true);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [muted, setMuted] = useState(true);
  const [failedSources, setFailedSources] = useState([]);
  const slide = slides[index];
  const failed = failedSources.includes(slide.src);
  const playing = !paused && inView && pageVisible;

  const advance = useCallback((direction) => {
    setPosition((current) => ({
      index: (current.index + direction + slides.length) % slides.length,
      previous: current.index,
    }));
    setMuted(true);
  }, []);

  const select = (next) => {
    setPaused(true);
    setMuted(true);
    if (next !== index) setPosition({ index: next, previous: index });
  };

  const browse = (direction) => {
    setPaused(true);
    advance(direction);
  };

  const markFailed = useCallback((src) => {
    setFailedSources((sources) => (sources.includes(src) ? sources : [...sources, src]));
  }, []);
  const pausePlayback = useCallback(() => setPaused(true), []);

  useEffect(() => {
    if (previous === null || readySource !== slide.src) return undefined;
    // Keep the outgoing media mounted until the incoming image/poster has faded in.
    const timer = window.setTimeout(() => {
      setPosition((current) => ({ ...current, previous: null }));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [previous, readySource, slide.src]);

  useEffect(() => {
    const strip = thumbnailsRef.current;
    const selected = strip?.children[index];
    if (selected)
      strip.scrollTo?.({
        left: selected.offsetLeft - strip.clientWidth / 2 + selected.clientWidth / 2,
      });
  }, [index]);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const updatePreference = () => {
      setPaused(
        motion.matches ||
          !!connection?.saveData ||
          ['slow-2g', '2g'].includes(connection?.effectiveType)
      );
    };
    const updateVisibility = () => setPageVisible(!document.hidden);
    const observer = window.IntersectionObserver
      ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 })
      : null;
    if (observer) observer.observe(galleryRef.current);
    else setInView(true);
    updatePreference();
    updateVisibility();
    motion.addEventListener('change', updatePreference);
    connection?.addEventListener?.('change', updatePreference);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      observer?.disconnect();
      motion.removeEventListener('change', updatePreference);
      connection?.removeEventListener?.('change', updatePreference);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    // Allow the full clip plus buffering time; a stalled download must not trap the slideshow.
    const duration = slide.video && !failed ? (slide.duration + 15) * 1000 : 6500;
    const timer = window.setTimeout(() => advance(1), duration);
    return () => window.clearTimeout(timer);
  }, [playing, index, slide.video, slide.duration, failed, advance]);

  const playbackLabel = paused ? 'Play slideshow' : 'Pause slideshow';

  return (
    <div
      ref={galleryRef}
      className="home-local-gallery"
      role="region"
      aria-roledescription="carousel"
      aria-label="Sattari photos and videos"
      onFocusCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          browse(event.key === 'ArrowRight' ? 1 : -1);
        }
      }}
    >
      <div
        className="home-local-gallery-stage"
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${slides.length}: ${slide.title}`}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch') touchStart.current = [event.clientX, event.clientY];
        }}
        onPointerCancel={() => {
          touchStart.current = null;
        }}
        onPointerUp={(event) => {
          if (!touchStart.current) return;
          const [x, y] = touchStart.current;
          touchStart.current = null;
          const distance = event.clientX - x;
          if (Math.abs(distance) > 50 && Math.abs(distance) > Math.abs(event.clientY - y)) {
            browse(distance < 0 ? 1 : -1);
          }
        }}
      >
        {[previous, index]
          .filter((value) => value !== null)
          .map((slideIndex) => (
            <GallerySlide
              key={slides[slideIndex].id}
              slide={slides[slideIndex]}
              active={slideIndex === index}
              playing={playing}
              muted={muted}
              failed={failedSources.includes(slides[slideIndex].src)}
              onFailed={markFailed}
              onReady={setReadySource}
              onEnded={advance}
              onBlocked={pausePlayback}
            />
          ))}
        <span className="home-local-gallery-kind">{slide.video ? 'Video' : 'Photo'}</span>
      </div>
      <div
        className="home-local-gallery-thumbnails"
        ref={thumbnailsRef}
        role="group"
        aria-label="Choose a photo or video"
      >
        {slides.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Show ${itemIndex + 1}: ${item.title}`}
            aria-pressed={index === itemIndex}
            tabIndex={index === itemIndex ? 0 : -1}
            title={item.title}
            onClick={() => select(itemIndex)}
            onKeyDown={(event) => {
              let next;
              if (event.key === 'ArrowRight') next = (itemIndex + 1) % slides.length;
              if (event.key === 'ArrowLeft') next = (itemIndex - 1 + slides.length) % slides.length;
              if (event.key === 'Home') next = 0;
              if (event.key === 'End') next = slides.length - 1;
              if (next === undefined) return;
              event.preventDefault();
              event.stopPropagation();
              select(next);
              thumbnailsRef.current.children[next].focus();
            }}
          >
            <img
              src={item.thumbnail}
              width="80"
              height="60"
              alt=""
              loading="lazy"
              decoding="async"
            />
            {item.video && <Play size={12} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="home-local-gallery-bar">
        <div
          className="home-local-gallery-caption"
          aria-live={playing ? 'off' : 'polite'}
          aria-atomic="true"
        >
          <span>
            {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </span>
          <strong>{slide.title}</strong>
          {failed && (
            <small>
              {slide.video ? 'Video unavailable. Showing a still.' : 'Photo unavailable.'}
            </small>
          )}
        </div>
        <div className="home-local-gallery-controls">
          <button
            type="button"
            onClick={() => browse(-1)}
            aria-label="Previous slide"
            title="Previous slide"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            onPointerDown={() => {
              playbackIntent.current = !paused;
            }}
            onPointerCancel={() => {
              playbackIntent.current = null;
            }}
            onClick={() => {
              // A pointer click focuses first, which also pauses the carousel.
              setPaused(playbackIntent.current ?? !paused);
              playbackIntent.current = null;
            }}
            aria-label={playbackLabel}
            title={playbackLabel}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
          {slide.video && !failed && (
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? 'Unmute video' : 'Mute video'}
              title={muted ? 'Unmute video' : 'Mute video'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => browse(1)}
            aria-label="Next slide"
            title="Next slide"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <div className="home-local-gallery-footer">
        <strong>Musician-owned. Music-minded.</strong>
        <div>
          <Link to="/about">
            Meet Mohammad Sattari <ArrowUpRight size={15} />
          </Link>
          <a
            href="https://maps.google.com/maps/contrib/103987062368900608516"
            target="_blank"
            rel="noopener noreferrer"
          >
            Photos on Google <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}
