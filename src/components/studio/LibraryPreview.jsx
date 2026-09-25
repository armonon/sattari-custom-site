import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Play,
  Pause,
  Headphones,
  X,
  Volume2,
  Music2,
} from 'lucide-react';
import './LibraryPreview.css';

const timeLabel = (value) => {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

// Deliberately outside the program/recording graph. Playback requires an explicit
// output choice; failed cue routing never falls back to the system speakers.
export default forwardRef(function LibraryPreview(
  {
    preview,
    onClose,
    onPrevious,
    onNext,
    onEnded,
    canPrevious,
    canNext,
    shuffle,
    onShuffle,
    repeat = 'off',
    onRepeat,
    continuous,
    onContinuous,
  },
  externalRef
) {
  const audio = useRef(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const [route, setRoute] = useState('');
  const [error, setError] = useState('');
  const [routing, setRouting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.25);
  useEffect(() => {
    setPlaying(false);
    setPosition(0);
    setDuration(0);
  }, [preview?.url]);
  const play = async () => {
    if (!route || routing || !preview || audio.current.muted) return;
    setError('');
    try {
      await audio.current.play();
    } catch {
      setError('Cannot start preview. Try Play again or choose another audio file.');
    }
  };
  const chooseOutput = async (speakers = false) => {
    const token = ++generation.current;
    audio.current?.pause();
    if (audio.current) audio.current.muted = true;
    setRoute('');
    setError('');
    setRouting(true);
    try {
      const device = speakers
        ? { deviceId: '', label: 'System speakers / default output' }
        : await navigator.mediaDevices.selectAudioOutput();
      if (!mounted.current || token !== generation.current) return;
      if (audio.current?.setSinkId) await audio.current.setSinkId(device.deviceId);
      else if (!speakers)
        throw new Error('This browser cannot route preview to a separate output.');
      if (!mounted.current || token !== generation.current) return;
      setRoute(device.label || 'Selected cue output');
      audio.current.muted = false;
    } catch (cause) {
      if (mounted.current && token === generation.current)
        setError(`Preview is muted. ${cause.message || 'Output selection failed.'}`);
    } finally {
      if (mounted.current && token === generation.current) setRouting(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    const element = audio.current;
    const requests = generation;
    element.volume = 0.25;
    element.muted = true;
    const disconnected = () => {
      requests.current++;
      element.pause();
      element.muted = true;
      setRoute('');
      setRouting(false);
      setError('Audio devices changed. Choose the preview output again before playing.');
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', disconnected);
    return () => {
      mounted.current = false;
      requests.current++;
      element.pause();
      element.muted = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', disconnected);
    };
  }, []);
  const canChoose =
    typeof navigator.mediaDevices?.selectAudioOutput === 'function' &&
    typeof HTMLMediaElement.prototype.setSinkId === 'function';
  return (
    <section className="sd-library-miniplayer" aria-label="Preview / cue player">
      <div className="sd-mini-song">
        <Music2 size={22} aria-hidden="true" />
        <div>
          <strong>{preview?.title || 'Nothing playing'}</strong>
          <small>{preview?.artist || 'Select a song to preview'}</small>
        </div>
      </div>
      <audio
        ref={(element) => {
          audio.current = element;
          if (externalRef) externalRef.current = element;
        }}
        src={preview?.url}
        hidden
        preload="metadata"
        aria-label={preview ? `Preview ${preview.title}` : 'Library preview audio'}
        onLoadedMetadata={() => {
          setDuration(Number.isFinite(audio.current.duration) ? audio.current.duration : 0);
          if (preview?.autoplay && route && !routing && !audio.current.muted)
            void audio.current
              .play()
              .catch(() =>
                setError('Press Play to continue preview. Your browser blocked automatic playback.')
              );
        }}
        onEnded={() => {
          setPlaying(false);
          if (route && !routing && !audio.current.muted) onEnded?.();
        }}
        onTimeUpdate={() => setPosition(audio.current.currentTime || 0)}
        onDurationChange={() =>
          setDuration(Number.isFinite(audio.current.duration) ? audio.current.duration : 0)
        }
        onPause={() => setPlaying(false)}
        onPlay={() => {
          if (!route || routing) {
            audio.current.muted = true;
            audio.current.pause();
            setPlaying(false);
          } else {
            setPlaying(true);
          }
        }}
        onError={() => {
          audio.current?.pause();
          setError('Cannot preview this file. Try MP3, WAV or AAC.');
        }}
      />
      <div className="sd-mini-playback">
        <div className="sd-mini-transport" aria-label="Preview transport">
          <button
            type="button"
            aria-label="Previous preview song"
            disabled={!preview || !canPrevious}
            onClick={() => onPrevious?.(!audio.current.paused)}
          >
            <SkipBack size={17} />
          </button>
          <button
            type="button"
            className="sd-mini-play"
            aria-label={playing ? 'Pause preview' : 'Play preview'}
            disabled={!preview || !route || routing}
            title={
              !route ? 'Choose a preview output first' : playing ? 'Pause preview' : 'Play preview'
            }
            onClick={() => (playing ? audio.current.pause() : void play())}
          >
            {playing ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            aria-label="Next preview song"
            disabled={!preview || !canNext}
            onClick={() => onNext?.(!audio.current.paused)}
          >
            <SkipForward size={17} />
          </button>
        </div>
        <div className="sd-mini-progress">
          <span>{timeLabel(position)}</span>
          <input
            type="range"
            aria-label="Preview position"
            min="0"
            max={duration || 1}
            step="0.01"
            value={Math.min(position, duration || 0)}
            disabled={!preview || !duration}
            onChange={(event) => {
              const next = Math.max(0, Math.min(duration, Number(event.target.value)));
              audio.current.currentTime = next;
              setPosition(next);
            }}
          />
          <span>{timeLabel(duration)}</span>
        </div>
      </div>
      <div className="sd-mini-options">
        <label className="sd-mini-volume">
          <Volume2 size={16} aria-hidden="true" />
          <input
            type="range"
            aria-label="Preview volume"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => {
              const next = Number(event.target.value);
              audio.current.volume = next;
              setVolume(next);
            }}
          />
        </label>
        <details
          className="sd-mini-output"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.open = false;
              event.currentTarget.querySelector('summary').focus();
            }
          }}
        >
          <summary
            aria-label="Preview output and options"
            title={route || 'Choose a preview output'}
          >
            <Headphones size={17} />
            {route ? 'Output' : 'Choose output'}
          </summary>
          <div className="sd-mini-output-menu">
            <strong>Preview output</strong>
            {canChoose && (
              <button type="button" disabled={routing} onClick={() => void chooseOutput()}>
                Choose cue output
              </button>
            )}
            <button type="button" disabled={routing} onClick={() => void chooseOutput(true)}>
              Use system speakers
            </button>
            <small>
              {route
                ? `Output: ${route}. Not included in the recorded master.`
                : 'Muted until you choose an output. System speakers may be audible to your audience.'}
              {!canChoose && ' Separate-device cueing is unavailable in this browser.'}
            </small>
            {onNext && (
              <div className="sd-mini-repeat">
                <button
                  type="button"
                  aria-label="Shuffle preview"
                  aria-pressed={!!shuffle}
                  onClick={onShuffle}
                >
                  <Shuffle size={17} />
                </button>
                <button
                  type="button"
                  aria-label={`Preview repeat: ${repeat}`}
                  aria-pressed={repeat !== 'off'}
                  onClick={onRepeat}
                >
                  {repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
                  <span>{repeat === 'off' ? 'Off' : repeat === 'all' ? 'All' : 'One'}</span>
                </button>
                <button type="button" aria-pressed={!!continuous} onClick={onContinuous}>
                  Continuous preview
                </button>
                <small>
                  Uses the current song list. Up Next stays a separate, manual deck queue.
                </small>
              </div>
            )}
          </div>
        </details>
        {preview && (
          <button type="button" aria-label="Close preview" title="Close preview" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
});
