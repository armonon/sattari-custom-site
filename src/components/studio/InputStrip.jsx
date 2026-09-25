import { useEffect, useState } from 'react';
import {
  AudioLines,
  ChevronDown,
  Circle,
  Headphones,
  Power,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import './InputStrip.css';
import { StudioPanel } from './StudioPanel';
import { Knob } from './StemDeckChannel';

export default function InputStrip({ getEngine, onChoose, onActiveChange, visible = true }) {
  const [state, setState] = useState({
    status: 'disconnected',
    peak: 0,
    gainDb: 0,
    highpass: 80,
    channel: -1,
  });
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const poll = () => {
      const next = getEngine().getInputState?.();
      if (!next) return;
      setState((previous) => (visible || previous.status !== next.status ? next : previous));
      onActiveChange?.(['connected', 'interrupted'].includes(next.status));
    };
    poll();
    const timer = setInterval(poll, visible ? 100 : 1000);
    return () => clearInterval(timer);
  }, [getEngine, onActiveChange, visible]);
  const change = (patch) => {
    try {
      getEngine().setInputSettings(patch);
      setError('');
      setState(getEngine().getInputState());
    } catch (reason) {
      setError(reason.message);
    }
  };
  const refresh = async () => {
    try {
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput')
      );
    } catch (reason) {
      setError(reason.message);
    }
  };
  const connect = async (id = state.deviceId) => {
    setBusy(true);
    setError('');
    try {
      await getEngine().openMicrophone(id);
      await refresh();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };
  const connected = ['connected', 'interrupted'].includes(state.status);
  const peakDb = state.peak > 0 ? Math.max(-60, 20 * Math.log10(state.peak)) : -60;
  const statusLabel =
    state.status === 'connected'
      ? 'Connected'
      : state.status === 'interrupted'
        ? 'Interrupted'
        : 'Disconnected';
  return (
    <StudioPanel
      panelId="input"
      label="Input"
      className="sd-input-strip sd-input-hardware"
      aria-label="Live input strip"
      summary={
        <header className="sd-input-readout" data-panel-summary>
          <span className={`sd-input-link-state is-${state.status}`} role="status">
            <i aria-hidden="true" />
            {statusLabel}
          </span>
          <div className="sd-input-level-display">
            <meter
              className="sd-input-native-meter"
              aria-label="Input peak"
              min="-60"
              max="0"
              value={Math.min(0, peakDb)}
              aria-valuetext={state.peak > 0 ? `${peakDb.toFixed(1)} dBFS` : 'Silent'}
            />
            <div className="sd-input-led-meter" aria-hidden="true">
              {Array.from({ length: 20 }, (_, index) => (
                <i
                  key={index}
                  className={`${state.peak > 0 && peakDb >= -60 + index * 3 ? 'is-lit ' : ''}${index >= 18 ? 'is-red' : index >= 15 ? 'is-amber' : ''}`}
                />
              ))}
            </div>
            <span className="sd-input-db">
              {state.peak > 0 ? `${peakDb.toFixed(1)}` : '−∞'} <small>dBFS</small>
            </span>
            <span className={`sd-input-clip${state.clipping ? ' is-clipping' : ''}`}>
              {state.clipping ? 'CLIPPING' : 'PEAK'}
            </span>
          </div>
          {state.armed && <span className="sd-input-armed-status">Armed</span>}
          {state.monitor && <span className="sd-input-monitor-status">Monitor on</span>}
        </header>
      }
    >
      <div className="sd-input-controls sd-input-front-panel">
        <button
          className="sd-input-source"
          type="button"
          onClick={onChoose}
          disabled={busy}
          aria-label="Choose device"
          title="Choose mic or audio interface"
        >
          <AudioLines size={20} aria-hidden="true" />
          <span>
            <small>Source</small>
            <strong>{state.label || 'Mic / interface'}</strong>
          </span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
        <label className="sd-input-channel">
          Channel
          <select
            aria-label="Input channel"
            value={state.channel}
            onChange={(e) => change({ channel: Number(e.target.value) })}
          >
            <option value="-1">Auto / stereo</option>
            {Array.from(
              { length: Math.max(state.channelCount || 0, state.channel + 1) },
              (_, i) => (
                <option key={i} value={i}>
                  Mono {i + 1}
                </option>
              )
            )}
          </select>
        </label>
        <Knob
          label="Gain"
          ariaLabel="Input gain"
          value={state.gainDb}
          min={-60}
          max={24}
          suffix=" dB"
          accent="#b6c8df"
          onChange={(gainDb) => change({ gainDb })}
        />
        <button
          type="button"
          className="sd-input-switch sd-input-arm"
          aria-label="Record arm"
          aria-pressed={!!state.armed}
          onClick={() => change({ armed: !state.armed })}
        >
          <Circle size={14} fill={state.armed ? 'currentColor' : 'none'} aria-hidden="true" />
          <span>
            Arm<small>{state.armed ? 'Ready' : 'Off'}</small>
          </span>
        </button>
        <button
          type="button"
          className="sd-input-switch sd-input-monitor"
          aria-label={`Monitor ${state.monitor ? 'on' : 'off'}`}
          title="Input monitoring · use headphones to avoid feedback"
          aria-pressed={!!state.monitor}
          disabled={!connected}
          onClick={() => change({ monitor: !state.monitor })}
        >
          <Headphones size={17} aria-hidden="true" />
          <span>
            Monitor<small>{state.monitor ? 'On' : 'Off'}</small>
          </span>
        </button>
        <button
          type="button"
          className="sd-input-switch sd-input-latency"
          aria-label="Low latency"
          title="Bypass input FX; master effects and device latency still apply"
          aria-pressed={!!state.lowLatency}
          onClick={() => change({ lowLatency: !state.lowLatency })}
        >
          <Zap size={16} aria-hidden="true" />
          <span>
            Low latency<small>{state.lowLatency ? 'FX bypassed' : 'Off'}</small>
          </span>
        </button>
        <button
          type="button"
          className="sd-input-power"
          aria-label={connected ? 'Disconnect' : busy ? 'Connecting…' : 'Reconnect'}
          title={connected ? 'Disconnect input' : 'Reconnect input'}
          disabled={busy}
          onClick={() => (connected ? getEngine().closeMicrophone() : void connect())}
        >
          <Power size={19} aria-hidden="true" />
        </button>
      </div>
      <details className="sd-input-setup">
        <summary>
          <SlidersHorizontal size={14} aria-hidden="true" /> Setup & FX{' '}
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="sd-input-controls sd-input-back-panel">
          <label>
            Device
            <select
              aria-label="Live input device"
              disabled={busy}
              value={state.deviceId || ''}
              onFocus={refresh}
              onChange={(e) => void connect(e.target.value)}
            >
              <option value="">System default</option>
              {state.deviceId && !devices.some((d) => d.deviceId === state.deviceId) && (
                <option value={state.deviceId}>{state.label || 'Selected device'}</option>
              )}
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Input ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Low cut · {state.highpass} Hz
            <input
              aria-label="Input low cut"
              type="range"
              min="20"
              max="300"
              value={state.highpass}
              disabled={state.lowLatency}
              onChange={(e) => change({ highpass: +e.target.value })}
            />
          </label>
          <button
            type="button"
            aria-pressed={!!state.compression}
            disabled={state.lowLatency}
            onClick={() => change({ compression: !state.compression })}
          >
            Compressor
          </button>
        </div>
        <small>
          Arm records a separate dry lane, even with monitoring off. Input FX affect
          monitoring/master only. Low latency bypasses input FX; master effects and device latency
          remain.
          {state.estimatedLatencyMs > 0 &&
            ` Driver/context estimate: ${state.estimatedLatencyMs.toFixed(1)} ms — not measured round-trip.`}
        </small>
      </details>
      {(error || state.error) && <p role="alert">{error || state.error}</p>}
    </StudioPanel>
  );
}
