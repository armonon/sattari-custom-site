import { useEffect, useRef, useState } from 'react';
import { PanelToggle, StudioPanel, useStudioPanel } from './StudioPanel';
import {
  ChevronDown,
  ChevronUp,
  Headphones,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Mic2,
  Drum,
  Waves,
  Layers,
  AudioLines,
  ShieldCheck,
  Gauge,
  Plus,
  CircleDot,
} from 'lucide-react';
import {
  DEFAULT_MASTER_PROCESSING,
  MASTER_STEMS,
  normalizeMasterStems,
  normalizeMasterProcessing,
  masterComparisonSnapshot,
  masterDeliveryReadings,
} from '../../utils/masterOutput';
import './MasterOutput.css';
import './MasterOutputModern.css';
import ArrangementRack from './ArrangementRack';
import { draggedEffects, validateEffects, EFFECT_DRAG_TYPE } from '../../utils/arrangementEffects';

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
const loudnessValue = (value) => (Number.isFinite(value) ? value.toFixed(1) : '—');
const STEM_SYMBOLS = {
  vocals: Mic2,
  drums: Drum,
  bass: Waves,
  other: Layers,
  unseparated: AudioLines,
};

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
  compact = false,
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
  visible = true,
}) {
  const masterPanel = useStudioPanel('master');
  const [expanded, setExpanded] = useState(false);
  const [rackOpen, setRackOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [status, setStatus] = useState(SILENT);
  const [monitor, setMonitor] = useState({ mono: false, dimmed: false, muted: false });
  const [error, setError] = useState('');
  const [comparisons, setComparisons] = useState({});
  const [comparisonMessage, setComparisonMessage] = useState('');
  const hold = useRef(-96);
  const clipped = useRef(false);
  const monitorState = useRef(monitor);
  const processing = normalizeMasterProcessing(settings);
  const delivery = masterDeliveryReadings(status.loudness, processing);
  const recall = (slot) => {
    const snapshot = comparisons[slot];
    if (!snapshot || captureActive) return;
    onSettings({ ...settings, ...snapshot.processing });
    onLevel(snapshot.level);
    onLimiter(snapshot.limiter);
    onCompression(snapshot.compression);
    setComparisonMessage(`Recalled ${slot}.`);
  };
  const stems = normalizeMasterStems(settings.stems);
  const stemSolo = Object.values(stems).some((stem) => stem.solo);
  const changeStem = (id, update) =>
    onSettings({ ...settings, stems: { ...stems, [id]: { ...stems[id], ...update } } });
  const changeEffects = (effects) => {
    validateEffects(effects);
    onSettings({ ...settings, effects });
    setError('');
  };
  const acceptsDrop = (event) =>
    Array.from(event.dataTransfer.types || []).some(
      (type) => type === EFFECT_DRAG_TYPE || type === 'Files'
    );
  const drop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDropActive(false);
    try {
      changeEffects([...(settings.effects || []), ...draggedEffects(event.dataTransfer)]);
      setRackOpen(true);
    } catch (reason) {
      setError(reason.message);
    }
  };

  // Meters update only this component, reusing the engine's small analysis buffers.
  // Hidden tabs do no metering work; silent output backs off to 2.5 Hz.
  useEffect(() => {
    let timer;
    const sample = () => {
      if (document.hidden || !visible) return;
      const next = getEngine().getMasterStatus();
      hold.current = Math.max(hold.current, next.peak);
      clipped.current ||= next.clipped;
      setStatus({ ...next, stemSources: getEngine().getMasterStemSources?.() || {} });
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
  }, [getEngine, visible]);

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
      {...masterPanel.attributes}
      className={`sd-output-console sd-master-modern${compact ? ' is-compact' : ''}${expanded ? ' is-expanded' : ''}${dropActive ? ' is-effect-drop' : ''}`}
      aria-label="Master output status"
      hidden={!visible}
      onDragOver={(event) => {
        if (!acceptsDrop(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
        setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDropActive(false);
      }}
      onDrop={drop}
    >
      <header className="sd-master-summary" data-panel-summary>
        <div className="sd-master-heading">
          <div>
            <PanelToggle panel={masterPanel} label="Master output" />
            <small>
              {captureActive
                ? 'Recording program mix'
                : limiter
                  ? `Limit ${settings.ceiling.toFixed(1)} dB`
                  : 'Limiter off'}
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
          <div className="sd-master-meter-scale" aria-hidden="true">
            <span>−60</span>
            <span>−30</span>
            <span>−12</span>
            <span>0 dBFS</span>
          </div>
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
            Peak hold
            <strong>
              {db(hold.current)} <small>dBFS</small>
            </strong>
          </span>
          <span>
            <span title="Integrated programme loudness">LUFS-I</span>
            <strong>{loudnessValue(status.loudness?.integrated)}</strong>
          </span>
          <span title="Compressor gain reduction">
            GR
            <strong>
              {(status.reduction || 0).toFixed(1)} <small>dB</small>
            </strong>
          </span>
        </div>
        <div className="sd-master-quick-controls" role="group" aria-label="Master quick controls">
          <button
            type="button"
            className={monitor.muted ? 'is-danger is-active' : ''}
            aria-label={monitor.muted ? 'Unmute speakers' : 'Mute speakers'}
            title={monitor.muted ? 'Unmute speakers' : 'Mute speakers · recording unaffected'}
            aria-pressed={monitor.muted}
            onClick={() => toggle('muted')}
          >
            {monitor.muted ? (
              <VolumeX size={17} aria-hidden="true" />
            ) : (
              <Volume2 size={17} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label="Toggle master limiter"
            title={limiter ? 'Limiter on' : 'Limiter off'}
            aria-pressed={limiter}
            onClick={() => onLimiter(!limiter)}
          >
            <ShieldCheck size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="sd-master-fx-toggle"
            aria-label={`Master FX · ${settings.effects?.length || 0} / 8`}
            title="Master effects · add or edit inserts"
            aria-expanded={rackOpen}
            onClick={() => {
              setRackOpen(!rackOpen);
              if (compact) setExpanded(true);
            }}
          >
            <Plus size={15} aria-hidden="true" /> FX <span>{settings.effects?.length || 0}</span>
          </button>
          <button
            type="button"
            className="sd-master-expand"
            aria-label={expanded ? 'Close master' : 'Open master'}
            title={expanded ? 'Close master controls' : 'Tone, dynamics & monitoring'}
            aria-expanded={expanded}
            onClick={() => {
              if (expanded) setRackOpen(false);
              setExpanded(!expanded);
            }}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </header>
      {dropActive && (
        <div className="sd-master-insert-bar" role="status">
          Drop to add to the master mix
        </div>
      )}
      {error && (
        <p role="alert" className="sd-master-drop-error">
          {error}
        </p>
      )}
      {rackOpen && (
        <ArrangementRack
          scope="master"
          tracks={[{ id: 'master', name: 'Master output', effects: settings.effects || [] }]}
          selectedTrackId="master"
          onSelectTrack={() => {}}
          onEffects={(_id, effects) => changeEffects(effects)}
        />
      )}
      <StudioPanel
        panelId="master-stems"
        label="Master stems"
        className="sd-master-stems"
        aria-label="Master stem mixer"
        summary={
          <button
            type="button"
            aria-label="Reset stem mix"
            title="Reset all stem levels, mutes and solos"
            onClick={() => onSettings({ ...settings, stems: normalizeMasterStems() })}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        }
      >
        <div className="sd-master-stem-grid">
          {MASTER_STEMS.map(({ id, label, color }) => {
            const StemSymbol = STEM_SYMBOLS[id];
            const stem = stems[id],
              suppressed = stem.muted || (stemSolo && !stem.solo),
              state = stem.muted
                ? 'Muted'
                : suppressed
                  ? 'Excluded'
                  : stem.solo
                    ? 'Solo'
                    : stem.level === 0
                      ? 'Silent'
                      : stem.level > 100
                        ? 'Boost'
                        : stem.level < 100
                          ? 'Reduced'
                          : 'Unity';
            return (
              <section
                key={id}
                className={`sd-master-stem ${suppressed ? 'is-suppressed' : ''} ${stem.solo ? 'is-solo' : ''}`}
                style={{ '--stem-color': color }}
                aria-label={`${label} master stem`}
              >
                <div className="sd-master-stem-title">
                  <div title={label}>
                    <span className="sd-master-stem-badge" aria-hidden="true">
                      <StemSymbol size={17} />
                    </span>
                    <strong>
                      {
                        {
                          vocals: 'VOX',
                          drums: 'DRM',
                          bass: 'BAS',
                          other: 'OTH',
                          unseparated: 'MIX',
                        }[id]
                      }
                    </strong>
                  </div>
                  <span className="sd-master-stem-state" title={state}>
                    {state}
                  </span>
                </div>
                <div className="sd-master-stem-gain">
                  <output aria-label={`${label} gain`}>
                    {stem.level}
                    <span>%</span>
                  </output>
                  <button
                    type="button"
                    aria-label={`Reset master ${label.toLowerCase()} level`}
                    title="Reset level to 100%"
                    onClick={() => changeStem(id, { level: 100 })}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                  </button>
                </div>
                <Control
                  label={`Master ${label.toLowerCase()} level`}
                  value={stem.level}
                  min={0}
                  max={300}
                  unit="%"
                  onChange={(level) => changeStem(id, { level })}
                />
                <div className="sd-master-stem-scale" aria-hidden="true">
                  <span>0</span>
                  <span>100</span>
                  <span>300%</span>
                </div>
                <div className="sd-master-stem-actions">
                  <button
                    type="button"
                    aria-label={`Mute master ${label.toLowerCase()}`}
                    title={`Mute ${label.toLowerCase()}`}
                    aria-pressed={stem.muted}
                    onClick={() => changeStem(id, { muted: !stem.muted })}
                  >
                    <VolumeX size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Solo master ${label.toLowerCase()}`}
                    title={`Solo ${label.toLowerCase()}`}
                    aria-pressed={stem.solo}
                    onClick={() => changeStem(id, { solo: !stem.solo })}
                  >
                    <Headphones size={15} aria-hidden="true" />
                  </button>
                </div>
                <small>
                  {id === 'unseparated'
                    ? 'Full mixes · inputs · pads'
                    : `${status.stemSources?.[id] || 0} deck sources · assigned tracks`}
                </small>
              </section>
            );
          })}
        </div>
        <details className="sd-master-stem-help">
          <summary>Routing & signal flow</summary>
          <p>
            Controls existing stems—not AI separation. Assign arrangement tracks in Track options.
            Deck controls act before shared deck effects, so effect tails can remain. Changes affect
            the recorded mix.
          </p>
          <p>
            VOX · vocals / DRM · drums / BAS · bass / OTH · other / MIX · full mixes, inputs and
            pads.
          </p>
        </details>
      </StudioPanel>
      {(monitor.muted || monitor.dimmed || monitor.mono || status.state !== 'running' || error) && (
        <div className="sd-master-notice" role="status" data-panel-summary>
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
          <StudioPanel panelId="master-tone" label="Tone" aria-label="Master tone">
            <header>
              <strong>
                <SlidersHorizontal size={16} aria-hidden="true" /> Tone & stereo
              </strong>
              <button
                type="button"
                aria-pressed={settings.bypass}
                onClick={() => change('bypass', !settings.bypass)}
              >
                {settings.bypass ? 'Restore tone' : 'Audition neutral'}
              </button>
            </header>
            <p>Shape the program mix before compression and limiting.</p>
            <Control
              label="Input trim"
              value={processing.inputTrim}
              min={-18}
              max={12}
              step={0.1}
              unit=" dB"
              onChange={(value) => change('inputTrim', value)}
            />
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
            <details className="sd-master-pro-group">
              <summary>EQ crossovers</summary>
              <Control
                label="Low crossover"
                value={processing.lowFrequency}
                min={80}
                max={800}
                step={10}
                unit=" Hz"
                disabled={settings.bypass}
                onChange={(value) => change('lowFrequency', value)}
              />
              <Control
                label="High crossover"
                value={processing.highFrequency}
                min={1000}
                max={12000}
                step={100}
                unit=" Hz"
                disabled={settings.bypass}
                onChange={(value) => change('highFrequency', value)}
              />
              <small>
                Band boundaries. Neutral audition bypasses tone and width, not trims or inserts.
              </small>
            </details>
            <details className="sd-master-pro-group">
              <summary>Tone & dynamics A/B</summary>
              <p>
                Session-only snapshots of tone, trims, output gain and dynamics. Inserts, stems and
                delivery targets stay unchanged. Not level-matched.
              </p>
              <div className="sd-master-comparisons">
                {['A', 'B'].map((slot) => (
                  <div key={slot}>
                    <button
                      type="button"
                      disabled={captureActive}
                      onClick={() => {
                        setComparisons((current) => ({
                          ...current,
                          [slot]: masterComparisonSnapshot(settings, level, limiter, compression),
                        }));
                        setComparisonMessage(`Stored ${slot}.`);
                      }}
                    >
                      {comparisons[slot] ? `Replace ${slot}` : `Store ${slot}`}
                    </button>
                    <button
                      type="button"
                      disabled={captureActive || !comparisons[slot]}
                      onClick={() => recall(slot)}
                    >
                      Recall {slot}
                    </button>
                  </div>
                ))}
              </div>
              <small role="status">
                {captureActive
                  ? 'A/B unavailable while recording.'
                  : comparisonMessage ||
                    'Store two versions to compare. Cleared when this view is reloaded.'}
              </small>
            </details>
          </StudioPanel>
          <StudioPanel
            panelId="master-dynamics"
            label="Dynamics & protection"
            aria-label="Master dynamics"
          >
            <header>
              <strong>
                <Gauge size={16} aria-hidden="true" /> Dynamics & protection
              </strong>
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
              label="Pre-limiter trim"
              value={processing.limiterDrive}
              min={-18}
              max={6}
              step={0.1}
              unit=" dB"
              onChange={(value) => change('limiterDrive', value)}
            />
            <small>
              After inserts and compression. Positive trim increases limiter drive; with the limiter
              off it can clip.
            </small>
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
                <dt>Integrated LUFS</dt>
                <dd>{loudnessValue(status.loudness?.integrated)}</dd>
              </div>
              <div>
                <dt>Momentary LUFS · 400 ms</dt>
                <dd>{loudnessValue(status.loudness?.momentary)}</dd>
              </div>
              <div>
                <dt>Short-term LUFS · 3 s</dt>
                <dd>{loudnessValue(status.loudness?.shortTerm)}</dd>
              </div>
              <div>
                <dt>True peak · 4×</dt>
                <dd>{loudnessValue(status.loudness?.truePeak)} dBTP</dd>
              </div>
              <div>
                <dt>Loudness range</dt>
                <dd>
                  {loudnessValue(status.loudness?.loudnessRange)} LU
                  {!status.loudness?.rangeStable && ' · settling (<60 s)'}
                </dd>
              </div>
              <div>
                <dt>Maximum momentary / short-term</dt>
                <dd>
                  {loudnessValue(status.loudness?.maxMomentary)} /{' '}
                  {loudnessValue(status.loudness?.maxShortTerm)} LUFS
                </dd>
              </div>
              <div>
                <dt>Compressor reduction</dt>
                <dd>{status.reduction.toFixed(1)} dB</dd>
              </div>
              <div>
                <dt>Sample peak hold</dt>
                <dd className={clipped.current ? 'is-danger' : ''}>{db(hold.current)} dBFS</dd>
              </div>
              <div>
                <dt>RMS</dt>
                <dd>{db(status.rms)} dBFS</dd>
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
              {status.loudness?.available
                ? 'Continuous BS.1770-based stereo loudness and 4× true-peak estimation. Integration resets when recording starts. Not EBU-certified.'
                : status.loudness?.error ||
                  'Enable audio to start continuous loudness measurement.'}{' '}
              This limiter is not a true-peak ceiling.
            </small>
            <button
              type="button"
              disabled={!status.loudness?.available || captureActive}
              onClick={() => getEngine().resetLoudness()}
            >
              Reset loudness
            </button>
            <button
              type="button"
              disabled={!status.loudness?.available || captureActive}
              onClick={() => getEngine().setLoudnessRunning(status.loudness?.measuring === false)}
            >
              {status.loudness?.measuring === false ? 'Resume integration' : 'Pause integration'}
            </button>
            {status.loudness?.measuring === false && (
              <small>Integrated loudness and range paused. Live meters continue.</small>
            )}
          </StudioPanel>
          <StudioPanel
            panelId="master-monitoring"
            label="Monitor & delivery"
            aria-label="Master monitoring"
          >
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
            <details className="sd-master-pro-group" open>
              <summary>Delivery reference</summary>
              <Control
                label="Loudness target"
                value={processing.targetLufs}
                min={-30}
                max={-8}
                step={0.5}
                unit=" LUFS"
                onChange={(value) => change('targetLufs', value)}
              />
              <Control
                label="True-peak target"
                value={processing.targetPeak}
                min={-6}
                max={-0.1}
                step={0.1}
                unit=" dBTP"
                onChange={(value) => change('targetPeak', value)}
              />
              <dl>
                <div>
                  <dt>Loudness below target</dt>
                  <dd>{loudnessValue(delivery.loudnessDelta)} LU</dd>
                </div>
                <div>
                  <dt>True-peak headroom</dt>
                  <dd
                    className={
                      delivery.peakMargin !== null && delivery.peakMargin < 0 ? 'is-danger' : ''
                    }
                  >
                    {loudnessValue(delivery.peakMargin)} dB
                  </dd>
                </div>
              </dl>
              <small>
                Negative values mean above target. Measurement reference only—not automatic
                normalization or a compliance check. Reset integration for each comparison.
              </small>
            </details>
            <button type="button" onClick={restore}>
              <RotateCcw size={13} /> Restore master defaults
            </button>
          </StudioPanel>
        </div>
      )}
      <footer>
        <span>
          <CircleDot size={11} aria-hidden="true" />{' '}
          {captureActive
            ? 'Recording'
            : status.state === 'running'
              ? 'Audio running'
              : 'Audio paused'}
        </span>
        <span>
          {status.sampleRate ? `${(status.sampleRate / 1000).toFixed(1)} kHz · ` : ''}Program → FX →
          dynamics → recording → monitor
        </span>
      </footer>
    </section>
  );
}
