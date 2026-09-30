import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Pause, Play } from 'lucide-react';
import { noteName, STRING_NAMES } from './music';

export function LearnWordmark() {
  return (
    <span className="sl-wordmark">
      <small>SATTARI</small>
      <strong>
        learn<span className="loop-brand-dot">.</span>
      </strong>
    </span>
  );
}

export function LoopMark({ className = '' }) {
  return (
    <svg
      className={`lh-mark ${className}`}
      width="46"
      height="32"
      viewBox="0 0 64 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M32 20C24 5 8 4 5 17C1 32 20 39 32 20C44 1 63 8 59 23C56 36 40 35 32 20Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M24 20C18 10 9 16 12 23C15 29 21 25 24 20ZM40 20C46 30 55 24 52 17C49 11 43 15 40 20Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PracticeDeck({ lesson, onChoose }) {
  const player = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(75);
  const [time, setTime] = useState(0);
  const [error, setError] = useState('');
  const notes = lesson.notes.slice(0, 8);
  const end = notes.at(-1).end + 0.08;
  const active = Math.max(
    0,
    notes.findLastIndex((note) => note.start <= time)
  );
  useEffect(() => {
    const audio = player.current;
    const hide = () => {
      if (document.hidden) audio?.pause();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      audio?.pause();
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  const preview = async () => {
    const audio = player.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setError('');
    setTime(0);
    audio.currentTime = 0;
    audio.playbackRate = speed / 100;
    try {
      await audio.play();
    } catch {
      setPlaying(false);
      setError('The example couldn’t play. Open the lesson to try again.');
    }
  };
  return (
    <section
      className={`lh-deck${playing ? ' is-playing' : ''}`}
      aria-label="Try the practice player"
    >
      <span className="lh-screw lh-screw-tl" aria-hidden="true" />
      <span className="lh-screw lh-screw-tr" aria-hidden="true" />
      <div className="lh-deck-top">
        <span>
          <LoopMark /> practice player
        </span>
        <span className="lh-model">LEARN / 01</span>
      </div>
      <div className="lh-display">
        <div className="lh-display-top">
          <span>
            <i className={playing ? 'is-on' : ''} />
            {playing ? 'PLAYING EXAMPLE' : 'PRESS PLAY. TRY A PHRASE.'}
          </span>
          <span>{Math.round((lesson.bpm * speed) / 100)} BPM</span>
        </div>
        <div className="lh-display-title">
          <h2>{lesson.title}</h2>
          <span>{lesson.key}</span>
        </div>
        <div className="lh-mini-tab" aria-hidden="true">
          {[5, 4, 3, 2, 1, 0].map((string) => (
            <div key={string} className="lh-mini-string">
              <span>{STRING_NAMES[string]}</span>
              <i />
              {notes.map((note, index) => (
                <b
                  key={index}
                  style={{ left: `${12 + index * 11.5}%` }}
                  className={playing && active === index ? 'is-current' : ''}
                >
                  {note.string === string ? note.fret : ''}
                </b>
              ))}
            </div>
          ))}
        </div>
        <div className="lh-display-bottom">
          <span>
            {playing
              ? `${noteName(notes[active].midi)} · ${notes[active].fret === 0 ? 'open string' : `fret ${notes[active].fret}`}`
              : 'Your first 8 notes'}
          </span>
          <div aria-hidden="true">
            {notes.map((_, i) => (
              <i key={i} className={playing && i <= active ? 'is-lit' : ''} />
            ))}
          </div>
          <span>PHRASE 01</span>
        </div>
      </div>
      <div className="lh-deck-controls">
        <div className="lh-transport">
          <button
            type="button"
            className="lh-play-key"
            aria-label={playing ? 'Pause starter phrase' : 'Hear starter phrase'}
            aria-pressed={playing}
            onClick={() => void preview()}
          >
            {playing ? (
              <Pause size={23} fill="currentColor" />
            ) : (
              <Play size={23} fill="currentColor" />
            )}
          </button>
          <span>{playing ? 'PAUSE' : 'LISTEN'}</span>
        </div>
        <label className="lh-speed">
          <span className="lh-dial" style={{ '--dial-angle': `${(speed - 75) * 3}deg` }}>
            <i />
            <b>
              {speed}
              <small>%</small>
            </b>
          </span>
          <input
            type="range"
            min="50"
            max="100"
            step="25"
            value={speed}
            aria-label="Starter phrase speed"
            onChange={(e) => {
              const value = Number(e.target.value);
              setSpeed(value);
              if (player.current) player.current.playbackRate = value / 100;
            }}
          />
          <span>YOUR PACE</span>
        </label>
        <button
          type="button"
          className="lh-learn-key"
          onClick={() => {
            player.current?.pause();
            onChoose(lesson, null, null);
          }}
        >
          <ArrowUpRight size={26} />
          <span>Learn this song</span>
        </button>
      </div>
      <div className="lh-deck-bottom">
        <span className="lh-speaker" aria-hidden="true" />
        <span>LISTEN. TRY. REPEAT.</span>
        <i aria-hidden="true" />
      </div>
      {error && (
        <p className="lh-preview-error" role="alert">
          {error}
        </p>
      )}
      <audio
        ref={player}
        src={lesson.audioUrl}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setError('The example couldn’t load. Open the lesson to try again.');
        }}
        onTimeUpdate={() => {
          const audio = player.current;
          if (audio.currentTime >= end) {
            audio.pause();
            audio.currentTime = 0;
            setTime(0);
          } else setTime(audio.currentTime);
        }}
      />
    </section>
  );
}
