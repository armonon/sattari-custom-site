import { useEffect, useRef } from 'react';
import {
  AlignJustify,
  ArrowLeft,
  Circle,
  Folder,
  Grid2X2,
  Mic2,
  Pause,
  Play,
  Settings,
  SlidersHorizontal,
  Square,
} from 'lucide-react';
import StudioAction from '../../components/studio/StudioAction';
import SessionOutputStatus from '../../components/studio/SessionOutputStatus';
import { clampNumber } from '../session/sessionModel';
import { SuiteMenu } from '../../suite/SuiteUi';

const VIEWS = [
  ['library', 'Library', Folder],
  ['decks', 'Perform', Grid2X2],
  ['arranger', 'Arrange', AlignJustify],
];

const PROJECT_KEYS = ['Off', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const LIBRARY_TRACK_TYPE = 'application/x-sattari-library-track';

export default function CommandBar({
  activeView,
  onViewChange,
  mixerOpen,
  onToggleMixer,
  mixerToggleRef,
  onLibraryDrop,
  transport,
  session,
  actions,
  capture,
  inspector,
  onToggleInspector,
  getEngine,
  advancedVisible,
  onToggleAdvanced,
  settingsOpen,
  onToggleSettings,
}) {
  const barRef = useRef(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const update = () =>
      bar.parentElement.style.setProperty(
        '--session-command-height',
        `${bar.getBoundingClientRect().height}px`
      );
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    update();
    return () => observer.disconnect();
  }, []);
  const { masterBpm, projectKey, restored } = session;
  const { setMasterBpm: onMasterBpm, setProjectKey: onProjectKey } = actions;
  const { captureActive, captureBusy, toggleCapture } = capture;

  return (
    <header className="sd-command-bar" ref={barRef}>
      <nav className="sd-view-nav" aria-label="STEMDECK workspaces">
        {VIEWS.map(([value, label, Icon]) => (
          <button
            type="button"
            key={value}
            className={activeView === value ? 'is-active' : ''}
            aria-current={activeView === value ? 'page' : undefined}
            title={label}
            onClick={() => onViewChange(value)}
            onDragOver={(event) => {
              if (
                value !== 'library' &&
                Array.from(event.dataTransfer.types).includes(LIBRARY_TRACK_TYPE)
              )
                event.preventDefault();
            }}
            onDrop={async (event) => {
              const id = event.dataTransfer.getData(LIBRARY_TRACK_TYPE);
              if (!id || value === 'library') return;
              event.preventDefault();
              await onLibraryDrop(value, id);
            }}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
        {/* The mixer docks under every workspace, so it is a toggle, not a view. */}
        <button
          type="button"
          ref={mixerToggleRef}
          className={`sd-view-nav-toggle${mixerOpen ? ' is-active' : ''}`}
          aria-expanded={mixerOpen}
          aria-controls={mixerOpen ? 'studio-mixer-dock' : undefined}
          title="Mixer (M)"
          onClick={onToggleMixer}
        >
          <SlidersHorizontal size={20} aria-hidden="true" />
          <span>Mixer</span>
        </button>
      </nav>
      <div className="sd-command-leading">
        <div className="sd-global-transport" role="group" aria-label="Global transport">
          <StudioAction
            type="button"
            className="is-primary"
            icon={transport.playing ? Pause : Play}
            label={transport.playing ? 'Pause' : transport.arrangement ? 'Play' : 'Play All'}
            onClick={transport.onToggle}
            disabled={!transport.available}
            aria-label={
              transport.arrangement
                ? `${transport.playing ? 'Pause' : 'Play'} arrangement transport`
                : transport.anyPlaying
                  ? 'Pause all decks'
                  : 'Play all decks'
            }
          />
        </div>
        <div className="sd-project-clock">
          <label className="sd-tempo-chip">
            <span>Tempo</span>
            <input
              type="number"
              min="40"
              max="240"
              value={masterBpm}
              onChange={(event) =>
                onMasterBpm(clampNumber(Number(event.target.value) || 120, 40, 240))
              }
              aria-label="Global tempo"
            />
            <small>BPM</small>
          </label>
          <label className="sd-project-key">
            <span>Key</span>
            <select
              value={projectKey}
              onChange={(event) => onProjectKey(event.target.value)}
              aria-label="Project key"
            >
              {PROJECT_KEYS.map((key) => (
                <option key={key}>{key}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="sd-title-block">
        <a
          className="sd-hub-return"
          href="/hub"
          aria-label="Back to Sattari Hub"
          title="Back to Sattari Hub"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </a>
        <h1 className="sd-product-brand">STEMDECK</h1>
        <small>
          <i className={restored ? 'is-ready' : ''} />
          {restored ? 'Local session' : 'Restoring…'}
        </small>
        <SuiteMenu className="sd-suite-menu" />
      </div>
      <div className="sd-system-actions" role="group" aria-label="Session actions">
        <button
          type="button"
          onClick={toggleCapture}
          disabled={captureBusy || !restored}
          className={captureActive ? 'sd-record-button is-recording' : 'sd-record-button'}
          aria-label={captureActive ? 'Stop recording live set' : 'Record live set'}
          title={captureActive ? 'Stop recording live set' : 'Record live set'}
        >
          <span className="sd-record-glyph" aria-hidden="true">
            {captureActive ? (
              <Square size={12} fill="currentColor" />
            ) : (
              <Circle size={14} fill="currentColor" />
            )}
          </span>
          <span className="sd-capture-label">
            {captureBusy ? 'Saving…' : captureActive ? 'Finish capture' : 'Capture'}
          </span>
        </button>
        <StudioAction
          type="button"
          icon={Mic2}
          label="Input inspector"
          aria-expanded={inspector === 'input'}
          aria-controls="session-inspector"
          onClick={(event) => onToggleInspector('input', event)}
        />
        <SessionOutputStatus
          getEngine={getEngine}
          expanded={inspector === 'master'}
          onClick={(event) => onToggleInspector('master', event)}
        />
        <StudioAction
          type="button"
          className={advancedVisible ? 'is-active sd-tools-button' : 'sd-tools-button'}
          onClick={onToggleAdvanced}
          aria-expanded={advancedVisible}
          icon={SlidersHorizontal}
          label={advancedVisible ? 'Close tools' : 'Tools'}
        />
        <StudioAction
          type="button"
          onClick={onToggleSettings}
          aria-label="Settings"
          aria-expanded={settingsOpen}
          icon={Settings}
          label="Settings"
        />
      </div>
    </header>
  );
}
