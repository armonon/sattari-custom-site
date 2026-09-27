import {
  FolderOpen,
  KeyRound,
  Maximize2,
  Mic2,
  Plus,
  Radio,
  Save,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import StudioAction from '../../components/studio/StudioAction';
import { PanelLayoutActions } from '../../components/studio/StudioPanel';
import ToolReferenceLink from '../../components/ToolReferenceLink';

export const READY_NOTICE = 'STEMDECK browser engine ready.';

const VIEW_TITLES = {
  decks: 'Perform',
  arranger: 'Arrange',
  library: 'Library',
  files: 'Project files',
};

export function AdvancedStrip({
  sessionName,
  onSessionName,
  activeView,
  onViewChange,
  mixerOpen,
  onToggleMixer,
  midiActive,
  onToggleMidi,
  microphoneActive,
  onToggleMicrophone,
  onSave,
  onImportSet,
  onOpenProject,
  onNewProject,
  setNotice,
}) {
  const fullscreenUnavailable = typeof document === 'undefined' || !document.fullscreenEnabled;
  return (
    <div className="sd-advanced-strip">
      <span className="sd-alpha-guide">LIVE TOOLS / MIXER / PROJECT / MIDI / AUDIO</span>
      <label className="sd-session-field">
        SESSION
        <input value={sessionName} onChange={(event) => onSessionName(event.target.value)} />
      </label>
      <StudioAction icon={Save} label="SAVE PROJECT" onClick={() => void onSave()} />
      <StudioAction
        type="button"
        className={mixerOpen ? 'is-active' : ''}
        aria-expanded={mixerOpen}
        onClick={onToggleMixer}
        icon={SlidersHorizontal}
        label="MIXER"
      />
      <StudioAction
        type="button"
        className={activeView === 'files' ? 'is-active' : ''}
        onClick={() => onViewChange('files')}
        icon={FolderOpen}
        label="FILES"
      />
      <StudioAction
        icon={Radio}
        label="MIDI"
        className={midiActive ? 'is-active' : ''}
        onClick={onToggleMidi}
      />
      <StudioAction
        type="button"
        className={microphoneActive ? 'is-active' : ''}
        onClick={onToggleMicrophone}
        icon={Mic2}
        label="MIC"
      />
      <StudioAction icon={FolderOpen} label="IMPORT SET" onClick={onImportSet} />
      <span>
        Audio device settings are managed by your browser. Open master for output level and limiter
        controls.
      </span>
      <button type="button" onClick={onOpenProject}>
        OPEN PROJECT
      </button>
      <button type="button" onClick={onNewProject}>
        NEW PROJECT
      </button>
      <button
        type="button"
        disabled={fullscreenUnavailable}
        title={
          fullscreenUnavailable ? 'Fullscreen is unavailable in this browser' : 'Toggle fullscreen'
        }
        onClick={async () => {
          try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
          } catch {
            setNotice('Fullscreen could not be opened. Your browser may not allow it.');
          }
        }}
      >
        <Maximize2 size={13} /> FULLSCREEN
      </button>
    </div>
  );
}

export function SettingsPopover({
  session,
  actions,
  compactIcons,
  onCompactIcons,
  onClose,
  onReset,
}) {
  const { limiter, aiMaster, crossfaderReverse } = session;
  const {
    setLimiter: onLimiter,
    setAiMaster: onAiMaster,
    setCrossfaderReverse: onCrossfaderReverse,
  } = actions;
  return (
    <aside className="sd-settings-popover" aria-label="Studio settings">
      <header>
        <strong>Settings</strong>
        <button type="button" onClick={onClose} aria-label="Close settings">
          <X size={13} />
        </button>
      </header>
      <label>
        <span>Compact icons</span>
        <input
          type="checkbox"
          checked={compactIcons}
          onChange={(event) => onCompactIcons(event.target.checked)}
          aria-describedby="sd-icon-preference-help"
        />
      </label>
      <p id="sd-icon-preference-help" className="sd-setting-help">
        Symbols for common actions. Turn off to show text labels.
      </p>
      <label>
        <span>Limiter</span>
        <input
          type="checkbox"
          checked={limiter}
          onChange={(event) => onLimiter(event.target.checked)}
        />
      </label>
      <label>
        <span>Master assist</span>
        <input
          type="checkbox"
          checked={aiMaster}
          onChange={(event) => onAiMaster(event.target.checked)}
        />
      </label>
      <label>
        <span>Reverse crossfader</span>
        <input
          type="checkbox"
          checked={crossfaderReverse}
          onChange={(event) => onCrossfaderReverse(event.target.checked)}
        />
      </label>
      <button type="button" onClick={onReset}>
        Reset session
      </button>
    </aside>
  );
}

// {'BPM'} and {'TAKES'} keep the unit words in their own text nodes, exactly
// as the page rendered them before these components were extracted.
export function TransferBanner({ transfer, onDismiss }) {
  return (
    <div className="sd-transfer-banner">
      <KeyRound size={13} />
      <span>
        LEARN MAP: <strong>{transfer.trackName}</strong> / {transfer.key} / {transfer.bpm} {'BPM'}
      </span>
      <button type="button" onClick={onDismiss}>
        <X size={12} />
      </button>
    </div>
  );
}

export function SessionNotice({ notice, capture, counts }) {
  const {
    captureActive,
    recordingHealth,
    unsavedTake,
    captureSeparateSources,
    setCaptureSeparateSources,
    longSession,
    setLongSession,
    downloadUnsavedTake,
    confirmUnsavedTake,
  } = capture;
  return (
    <details
      className="sd-notice"
      open={unsavedTake || (captureActive && recordingHealth?.error) ? true : undefined}
      data-visible={notice !== READY_NOTICE}
    >
      <summary>
        <span role={recordingHealth?.error && captureActive ? 'alert' : 'status'}>
          {captureActive && recordingHealth?.error ? recordingHealth.error : notice}
        </span>
      </summary>
      <div className="sd-session-notice-body">
        <ToolReferenceLink tool="studio" />
        <label>
          <input
            type="checkbox"
            checked={captureSeparateSources}
            disabled={captureActive}
            onChange={(event) => setCaptureSeparateSources(event.target.checked)}
          />{' '}
          Multitrack capture (recommended)
        </label>
        <label>
          <input
            type="checkbox"
            checked={longSession}
            disabled={captureActive}
            onChange={(event) => setLongSession(event.target.checked)}
          />{' '}
          Long-session WAV capture
        </label>
        {captureActive && recordingHealth && (
          <span role={recordingHealth.error ? 'alert' : undefined}>
            {recordingHealth.error ||
              `${Math.floor(recordingHealth.duration)}s · audio saved through ${Math.floor(recordingHealth.durableAudioSeconds)}s · ${recordingHealth.committedEvents} events saved · ${Math.round(recordingHealth.pendingBytes / 1048576)} MB pending`}
          </span>
        )}
        {unsavedTake && (
          <>
            <button type="button" onClick={downloadUnsavedTake}>
              Download unsaved take
            </button>
            <button type="button" onClick={confirmUnsavedTake}>
              I saved the backup
            </button>
          </>
        )}
        <small>
          {counts.decks} DECKS / {counts.stems} STEMS / {counts.takes} {'TAKES'}
        </small>
      </div>
    </details>
  );
}

export function WorkspaceHeading({
  activeView,
  sessionName,
  capture,
  takes,
  onOpenPerformance,
  onOpenExport,
  onImport,
  onSave,
}) {
  const { captureActive, captureBusy, recordingHealth } = capture;
  return (
    <header className="sd-workspace-heading">
      <div>
        <h2>{VIEW_TITLES[activeView]}</h2>
        <span className="sd-workspace-eyebrow">{sessionName}</span>
      </div>
      <div className="sd-workspace-quick-actions">
        {captureActive ? (
          <span className="sd-session-capture-state" role="status">
            ● Capturing · {Math.floor(recordingHealth?.duration || 0)}s
          </span>
        ) : (
          takes > 0 && (
            <button
              type="button"
              className="sd-open-performance"
              disabled={captureBusy}
              onClick={onOpenPerformance}
            >
              Open performance in Arrange <span>Take {takes}</span>
            </button>
          )
        )}
        {activeView === 'arranger' && (
          <button type="button" onClick={onOpenExport}>
            Export
          </button>
        )}
        <PanelLayoutActions />
        <StudioAction
          type="button"
          icon={Plus}
          label={activeView === 'library' ? 'Import songs' : 'Import audio'}
          onClick={onImport}
        />
        <StudioAction
          type="button"
          onClick={() => void onSave()}
          aria-label="Save project file"
          icon={Save}
          label="Save project"
        />
      </div>
    </header>
  );
}
