import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Headphones, RotateCcw, Volume2 } from 'lucide-react';
import { DEFAULT_MASTER_PROCESSING } from '../../utils/masterOutput';
import './MasterOutput.css';

const SILENT = {
  left: -96,
  right: -96,
  peak: -96,
  rms: -96,
  correlation: null,
  reduction: 0,
  state: 'suspended',
  sampleRate: 0,
};
const db = (value) => (value <= -96 ? '−∞' : value.toFixed(1));

function Control({ label, value, min, max, step = 1, unit = '', onChange, disabled = false }) {
  return (
    <label className="sd-master-control">
      <span>
        {label}
        <span className="sd-master-value">
          {Number(value).toFixed(step < 1 ? 1 : 0)}
          {unit}
        </span>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function MasterOutput({
  getEngine,
  settings,
  onSettings,
  level,
  onLevel,
  limiter,
  onLimiter,
  compression,
  onCompression,
  captureActive,
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(SILENT);
  const [monitor, setMonitor] = useState({ mono: false, dimmed: false, muted: false });
  const [error, setError] = useState('');
  const hold = useRef(-96);
  const clipped = useRef(false);
  const monitorState = useRef(monitor);

  // Meters update only this component, reusing the engine's small analysis buffers.
  // Hidden tabs do no metering work; silent output backs off to 2.5 Hz.
  useEffect(() => {
    let timer;
    const sample = () => {
      if (document.hidden) return;
      const next = getEngine().getMasterStatus();
      hold.current = Math.max(hold.current, next.peak);
      clipped.current ||= next.clipped;
      setStatus(next);
      timer = window.setTimeout(sample, next.peak > -70 ? 100 : 400);
    };
    const visibility = () => {
      window.clearTimeout(timer);
      if (!document.hidden) sample();
    };
    sample();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [getEngine]);

  const setMonitoring = (next) => {
    monitorState.current = next;
    setMonitor(next);
    getEngine().setMasterMonitor(next);
  };
  // Re-apply transient monitoring after New Project recreates the audio engine.
  useEffect(() => {
    getEngine().setMasterMonitor(monitorState.current);
  }, [getEngine, settings]);
  const change = (key, value) => onSettings({ ...settings, [key]: value });
  const restore = () => {
    onSettings({ ...DEFAULT_MASTER_PROCESSING });
    onLevel(100);
    onLimiter(true);
    onCompression(false);
    setMonitoring({ mono: false, dimmed: false, muted: false });
    hold.current = -96;
    clipped.current = false;
    setError('');
  };
  const toggle = (key) => setMonitoring({ ...monitor, [key]: !monitor[key] });

  return (
    <section
      className={`sd-output-console${expanded ? ' is-expanded' : ''}`}
      aria-label="Master output status"
    >
      <header className="sd-master-summary">
        <div className="sd-master-heading">
          <Volume2 size={18} />
          <div>
            <strong>MASTER OUTPUT</strong>
            <small>
              {captureActive
                ? 'RECORDING PROGRAM MIX'
                : limiter
                  ? `LIMITER TARGET · ${settings.ceiling.toFixed(1)} dB`
                  : 'LIMITER OFF'}
            </small>
          </div>
        </div>
        <div className="sd-master-stereo" aria-label="Program stereo sample peaks">
          {['left', 'right'].map((channel) => (
            <div key={channel}>
              <span>{channel === 'left' ? 'L' : 'R'}</span>
              <meter
                aria-label={`${channel} sample peak`}
                min="-60"
                max="0"
                low="-12"
                high="-3"
                optimum="-18"
                value={Math.max(-60, status[channel])}
              />
              <output>{db(status[channel])}</output>
            </div>
          ))}
        </div>
        <Control
          label="Master output level"
          value={level}
          min={0}
          max={125}
          unit="%"
          onChange={onLevel}
        />
        <div className="sd-master-summary-stats">
          <span>
            PEAK HOLD
            <strong>
              {db(hold.current)} <small>dBFS</small>
            </strong>
          </span>
          <span>
            RMS
            <strong>
              {db(status.rms)} <small>dBFS</small>
            </strong>
          </span>
        </div>
        <button
          type="button"
          className={monitor.muted ? 'is-danger is-active' : ''}
          aria-pressed={monitor.muted}
          onClick={() => toggle('muted')}
        >
          {monitor.muted ? 'Unmute speakers' : 'Mute speakers'}
        </button>
        <button
          type="button"
          className="sd-master-expand"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Close master' : 'Open master'}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </header>
      {(monitor.muted || monitor.dimmed || monitor.mono || status.state !== 'running' || error) && (
        <div className="sd-master-notice" role="status">
          {error ||
            (status.state !== 'running'
              ? 'Audio is paused. Press Enable audio or play a track.'
              : monitor.muted
                ? 'Speakers muted · recording continues at full program level.'
                : monitor.dimmed
                  ? 'Monitor dimmed −12 dB · recording is unchanged.'
                  : 'Mono audition · recording remains stereo.')}
          {status.state !== 'running' && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await getEngine().unlock();
                  setError('');
                } catch {
                  setError('Audio could not start. Check browser and device audio settings.');
                }
              }}
            >
              Enable audio
            </button>
          )}
        </div>
      )}
      {expanded && (
        <div className="sd-master-details">
          <section aria-label="Master tone">
            <header>
              <strong>Tone & stereo</strong>
              <button
                type="button"
                aria-pressed={settings.bypass}
                onClick={() => change('bypass', !settings.bypass)}
              >
                {settings.bypass ? 'Restore tone' : 'Audition neutral'}
              </button>
            </header>
            <p>Shape the program mix before compression and limiting.</p>
            {['low', 'mid', 'high'].map((band) => (
              <Control
                key={band}
                label={`Master ${band} EQ`}
                value={settings[band]}
                min={-12}
                max={12}
                step={0.5}
                unit=" dB"
                disabled={settings.bypass}
                onChange={(value) => change(band, value)}
              />
            ))}
            <Control
              label="Low-cut frequency"
              value={settings.lowCut}
              min={20}
              max={200}
              unit=" Hz"
              disabled={settings.bypass}
              onChange={(value) => change('lowCut', value)}
            />
            <Control
              label="Stereo width"
              value={settings.width}
              min={0}
              max={150}
              unit="%"
              disabled={settings.bypass}
              onChange={(value) => change('width', value)}
            />
            <small>100% is original stereo. Wider settings reduce the centre.</small>
          </section>
          <section aria-label="Master dynamics">
            <header>
              <strong>Dynamics & protection</strong>
            </header>
            <p>Use gentle compression for balance; adjust the limiter target for headroom.</p>
            <div className="sd-master-toggles">
              <button
                type="button"
                aria-pressed={compression}
                onClick={() => onCompression(!compression)}
              >
                Compression {compression ? 'on' : 'off'}
              </button>
              <button type="button" aria-pressed={limiter} onClick={() => onLimiter(!limiter)}>
                Limiter {limiter ? 'on' : 'off'}
              </button>
            </div>
            <Control
              label="Limiter threshold"
              value={settings.ceiling}
              min={-12}
              max={-0.1}
              step={0.1}
              unit=" dB"
              onChange={(value) => change('ceiling', value)}
            />
            <dl>
              <div>
                <dt>Compressor reduction</dt>
                <dd>{status.reduction.toFixed(1)} dB</dd>
              </div>
              <div>
                <dt>Sample peak hold</dt>
                <dd className={clipped.current ? 'is-danger' : ''}>{db(hold.current)} dBFS</dd>
              </div>
              <div>
                <dt>Sampled clip detected</dt>
                <dd>{clipped.current ? 'YES' : 'No'}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => {
                hold.current = -96;
                clipped.current = false;
                setStatus({ ...status });
              }}
            >
              Reset peak hold
            </button>
            <small>
              Sampled peak and RMS meters, not LUFS. This limiter is not a true-peak ceiling.
            </small>
          </section>
          <section aria-label="Master monitoring">
            <header>
              <strong>
                <Headphones size={15} /> Monitor & delivery
              </strong>
            </header>
            <p>Audition your speakers without changing the recorded master.</p>
            <div className="sd-master-toggles">
              <button type="button" aria-pressed={monitor.mono} onClick={() => toggle('mono')}>
                Mono audition
              </button>
              <button type="button" aria-pressed={monitor.dimmed} onClick={() => toggle('dimmed')}>
                Dim −12 dB
              </button>
            </div>
            <dl>
              <div>
                <dt>Stereo correlation</dt>
                <dd>{status.correlation === null ? '—' : status.correlation.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Engine</dt>
                <dd>{status.state === 'running' ? 'Running' : 'Paused'}</dd>
              </div>
              <div>
                <dt>Sample rate</dt>
                <dd>{status.sampleRate ? `${(status.sampleRate / 1000).toFixed(1)} kHz` : '—'}</dd>
              </div>
              <div>
                <dt>Recorder feed</dt>
                <dd>Program · pre-monitor</dd>
              </div>
            </dl>
            <small>Negative correlation can indicate cancellation when summed to mono.</small>
            <button type="button" onClick={restore}>
              <RotateCcw size={13} /> Restore master defaults
            </button>
          </section>
        </div>
      )}
      <footer>
        PROGRAM → TONE → DYNAMICS → LIMITER → RECORDING <span>→ MONITOR → SPEAKERS</span>
      </footer>
    </section>
  );
}
