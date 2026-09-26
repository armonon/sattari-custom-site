import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Download,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  Repeat2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { hubAudio } from '../data/hubAudio';

function timeLabel(value) {
  return `0:${String(Math.floor(value || 0)).padStart(2, '0')}`;
}

export default function HubListeningDesk() {
  const audioRef = useRef(null);
  const pendingRef = useRef({ position: 0, resume: false });
  const playRequestRef = useRef(0);
  const [trackId, setTrackId] = useState('mix');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(8);
  const [loop, setLoop] = useState(true);
  const [volume, setVolume] = useState(0.65);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const track = hubAudio.find(({ id }) => id === trackId);

  useEffect(() => {
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      playRequestRef.current += 1;
      audio.pause();
    };
  }, []);

  async function play() {
    const requestId = ++playRequestRef.current;
    setError('');
    try {
      await audioRef.current.play();
    } catch (cause) {
      if (requestId !== playRequestRef.current || cause?.name === 'AbortError') return;
      setError('Audio could not play. Try again or download the demo.');
      setPlaying(false);
      setLoading(false);
    }
  }

  function selectTrack(nextId) {
    if (nextId === trackId) return;
    const audio = audioRef.current;
    pendingRef.current = {
      position: loading ? pendingRef.current.position : audio.currentTime,
      resume: pendingRef.current.resume || (!audio.paused && !audio.ended),
    };
    playRequestRef.current += 1;
    audio.pause();
    setPlaying(false);
    setError('');
    setLoading(true);
    setTrackId(nextId);
  }

  function loaded() {
    const audio = audioRef.current;
    const length = Number.isFinite(audio.duration) ? audio.duration : 8;
    const seek = Math.min(pendingRef.current.position, Math.max(0, length - 0.01));
    const resume = pendingRef.current.resume;
    pendingRef.current = { position: seek, resume: false };
    audio.currentTime = seek;
    setDuration(length);
    setPosition(seek);
    setLoading(false);
    if (resume) void play();
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (error) {
      pendingRef.current = { position, resume: true };
      setError('');
      setLoading(true);
      audio.load();
    } else if (!audio.paused) {
      playRequestRef.current += 1;
      pendingRef.current.resume = false;
      audio.pause();
    } else {
      if (audio.ended) audio.currentTime = 0;
      void play();
    }
  }

  return (
    <section
      id="hub-listening-desk"
      className="hub-listening"
      data-track={trackId}
      aria-labelledby="hub-listening-title"
    >
      <div className="hub-section-heading">
        <h2 id="hub-listening-title">
          <Headphones size={18} aria-hidden="true" /> Listening desk
        </h2>
        <span>02 / 03</span>
      </div>
      <div className="hub-listening-header">
        <div>
          <p className="hub-eyebrow">Sattari original / 001</p>
          <h3>Inside the groove</h3>
          <p className="hub-demo-meta">
            120 BPM <span>/</span> Am - F - C - G <span>/</span> 4 bars
          </p>
        </div>
        <fieldset className="hub-source-switch">
          <legend className="hub-sr-only">Demo audio source</legend>
          {hubAudio.map(({ id, label }) => (
            <label key={id} className={id === trackId ? 'is-selected' : ''}>
              <input
                type="radio"
                name="hub-demo-source"
                value={id}
                checked={id === trackId}
                onChange={() => selectTrack(id)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="hub-player">
        <button
          className="hub-play-button"
          type="button"
          onClick={togglePlayback}
          disabled={loading}
          aria-label={error ? 'Retry demo audio' : playing ? 'Pause demo' : 'Play demo'}
          title={playing ? 'Pause demo' : 'Play demo'}
        >
          {loading ? (
            <LoaderCircle size={25} className="hub-loading" />
          ) : playing ? (
            <Pause size={25} fill="currentColor" />
          ) : (
            <Play size={25} fill="currentColor" />
          )}
        </button>
        <div className="hub-waveform-control">
          <div className="hub-waveform" aria-hidden="true">
            {track.peaks.map((peak, index) => (
              <span
                key={index}
                className={index / track.peaks.length < position / duration ? 'is-played' : ''}
                style={{ height: `${Math.max(3, peak)}%` }}
              />
            ))}
          </div>
          <input
            type="range"
            aria-label="Demo playback position"
            aria-valuetext={`${timeLabel(position)} of ${timeLabel(duration)}`}
            min="0"
            max={duration}
            step="0.01"
            value={position}
            disabled={loading || Boolean(error)}
            onChange={(event) => {
              const next = Number(event.target.value);
              audioRef.current.currentTime = next;
              setPosition(next);
            }}
          />
        </div>
        <output className="hub-player-time" aria-label="Playback time">
          {timeLabel(position)}
          <span>/ {timeLabel(duration)}</span>
        </output>
      </div>
      <div className="hub-player-toolbar">
        <div className="hub-player-settings">
          <button
            type="button"
            className="hub-icon-button"
            aria-label="Loop demo"
            aria-pressed={loop}
            title="Loop demo"
            onClick={() => setLoop((current) => !current)}
          >
            <Repeat2 size={19} />
          </button>
          <span className="hub-control-divider" aria-hidden="true" />
          <button
            type="button"
            className="hub-icon-button"
            aria-label={muted ? 'Unmute demo' : 'Mute demo'}
            title={muted ? 'Unmute demo' : 'Mute demo'}
            onClick={() => setMuted((current) => !current)}
          >
            {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            aria-label="Demo volume"
            aria-valuetext={`${Math.round(volume * 100)} percent`}
            onChange={(event) => {
              setVolume(Number(event.target.value));
              setMuted(false);
            }}
          />
        </div>
        <a
          className="hub-icon-button"
          href={track.file}
          download
          title={`Download ${track.label.toLowerCase()} WAV`}
          aria-label={`Download ${track.label.toLowerCase()} WAV`}
        >
          <Download size={19} />
        </a>
      </div>
      {error && (
        <p className="hub-audio-error" role="alert">
          {error}
        </p>
      )}
      <div className="hub-listening-footer">
        <p>Original practice loop. Bass and drums are actual separation estimates.</p>
        <Link to="/stem-separator" className="hub-text-link">
          Separate your track <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <audio
        ref={audioRef}
        src={track.file}
        preload="metadata"
        loop={loop}
        onLoadedMetadata={loaded}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setPosition(audioRef.current.currentTime)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          pendingRef.current.resume = false;
          setError('This demo could not load. Try again or choose another part.');
          setLoading(false);
          setPlaying(false);
        }}
      />
    </section>
  );
}
