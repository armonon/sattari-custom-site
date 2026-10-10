import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Headphones, LoaderCircle, Pause, Play, VolumeX } from 'lucide-react';
import { formatTime, LabWaveform } from '../audio/AudioLabParts';

/**
 * Sample-locked preview of separated stems: every lane is an AudioBuffer
 * started on the same AudioContext clock, so muting or soloing never drifts.
 * lanes: [{ id, label, color, blob, url?, name?, peaks }]
 */
export default function StemMixer({ lanes }) {
  const context = useRef(null);
  const buffers = useRef(new Map());
  const gains = useRef(new Map());
  const sources = useRef([]);
  const clock = useRef({ startedAt: 0, offset: 0 });
  const frame = useRef(0);
  const [state, setState] = useState({ status: 'loading', message: 'Preparing preview' });
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mix, setMix] = useState(() =>
    Object.fromEntries(
      lanes.map((lane) => [lane.id, { muted: Boolean(lane.muted), solo: false, level: 1 }])
    )
  );

  useEffect(() => {
    let cancelled = false;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      setState({ status: 'error', message: 'Web Audio is unavailable; use the downloads.' });
      return undefined;
    }
    const audio = new Context();
    const decoded = buffers.current;
    const nodes = gains.current;
    context.current = audio;
    (async () => {
      try {
        let longest = 0;
        for (const lane of lanes) {
          const buffer = await audio.decodeAudioData(await lane.blob.arrayBuffer());
          if (cancelled) return;
          buffers.current.set(lane.id, buffer);
          const gain = audio.createGain();
          gain.connect(audio.destination);
          gains.current.set(lane.id, gain);
          longest = Math.max(longest, buffer.duration);
        }
        setDuration(longest);
        setState({ status: 'ready', message: '' });
      } catch {
        if (!cancelled)
          setState({
            status: 'error',
            message: 'The preview could not be prepared (memory?). The WAV downloads still work.',
          });
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame.current);
      sources.current.forEach((source) => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      });
      void audio.close().catch(() => {});
      decoded.clear();
      nodes.clear();
    };
  }, [lanes]);

  // Apply mute/solo/level to the gain nodes.
  useEffect(() => {
    const audio = context.current;
    if (!audio) return;
    const anySolo = Object.values(mix).some((lane) => lane.solo);
    for (const [id, gain] of gains.current) {
      const lane = mix[id];
      const audible = lane && !lane.muted && (!anySolo || lane.solo);
      gain.gain.setTargetAtTime(audible ? lane.level : 0, audio.currentTime, 0.015);
    }
  }, [mix, state.status]);

  const stopSources = () => {
    sources.current.forEach((source) => {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    });
    sources.current = [];
    cancelAnimationFrame(frame.current);
  };

  const now = useCallback(() => {
    const audio = context.current;
    if (!audio || !clock.current.startedAt) return clock.current.offset;
    return clock.current.offset + audio.currentTime - clock.current.startedAt;
  }, []);

  const start = async (offset) => {
    const audio = context.current;
    if (!audio || state.status !== 'ready') return;
    await audio.resume();
    stopSources();
    const when = audio.currentTime + 0.05;
    for (const [id, buffer] of buffers.current) {
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(gains.current.get(id));
      source.start(when, Math.min(offset, buffer.duration));
      sources.current.push(source);
    }
    clock.current = { startedAt: when, offset };
    setPlaying(true);
    const tick = () => {
      const at = now();
      if (at >= duration) {
        stopSources();
        clock.current = { startedAt: 0, offset: 0 };
        setPosition(0);
        setPlaying(false);
        return;
      }
      setPosition(Math.max(0, at));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const pause = () => {
    const at = now();
    stopSources();
    clock.current = { startedAt: 0, offset: at };
    setPosition(at);
    setPlaying(false);
  };

  const seek = (seconds) => {
    if (playing) void start(seconds);
    else {
      clock.current = { startedAt: 0, offset: seconds };
      setPosition(seconds);
    }
  };

  const change = (id, patch) =>
    setMix((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const progress = duration ? position / duration : 0;

  return (
    <section className="alab-mixer" aria-label="Stem preview">
      <div className="alab-transport">
        <button
          type="button"
          className="alab-play"
          disabled={state.status !== 'ready'}
          onClick={() => (playing ? pause() : void start(clock.current.offset))}
          aria-label={playing ? 'Pause stems' : 'Play stems'}
        >
          {state.status === 'loading' ? (
            <LoaderCircle className="alab-spin" size={20} aria-hidden="true" />
          ) : playing ? (
            <Pause size={20} aria-hidden="true" />
          ) : (
            <Play size={20} aria-hidden="true" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max={duration || 1}
          step="0.01"
          value={position}
          disabled={state.status !== 'ready'}
          aria-label="Playback position"
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span className="alab-time">
          {formatTime(position)} / {formatTime(duration)}
        </span>
      </div>
      {state.message && <p className="alab-note">{state.message}</p>}
      <ul className="alab-lanes">
        {lanes.map((lane) => {
          const settings = mix[lane.id];
          return (
            <li key={lane.id} className="alab-lane" style={{ '--lane-color': lane.color }}>
              <span className="alab-lane-name">{lane.label}</span>
              <div className="alab-lane-buttons">
                <button
                  type="button"
                  aria-pressed={settings.muted}
                  className={settings.muted ? 'is-on' : undefined}
                  onClick={() => change(lane.id, { muted: !settings.muted })}
                  aria-label={`Mute ${lane.label}`}
                  title="Mute"
                >
                  <VolumeX size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-pressed={settings.solo}
                  className={settings.solo ? 'is-on' : undefined}
                  onClick={() => change(lane.id, { solo: !settings.solo })}
                  aria-label={`Solo ${lane.label}`}
                  title="Solo"
                >
                  <Headphones size={15} aria-hidden="true" />
                </button>
              </div>
              <LabWaveform peaks={lane.peaks} color={lane.color} progress={progress} />
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.01"
                value={settings.level}
                aria-label={`${lane.label} level`}
                onChange={(event) => change(lane.id, { level: Number(event.target.value) })}
              />
              {lane.url ? (
                <a
                  className="alab-icon-link"
                  href={lane.url}
                  download={lane.name}
                  aria-label={`Download ${lane.label} WAV`}
                  title={`Download ${lane.label} WAV`}
                >
                  <Download size={16} aria-hidden="true" />
                </a>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
