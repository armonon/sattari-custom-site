import { FolderOpen, Library, Mic2, Pause, Play, Settings, Square, Waves } from 'lucide-react';

const MODES = [
  ['decks', 'Perform'],
  ['arranger', 'Edit'],
  ['mixer', 'Mix'],
];

/**
 * Phone-only navigation and transport modeled after the native iPhone shell.
 * The desktop command bar remains mounted so engine state and keyboard behavior
 * stay shared; CSS swaps the visible chrome at the phone breakpoint.
 */
export default function MobileStudioChrome({
  activeView,
  onViewChange,
  mixerOpen,
  onShowMixer,
  onHideMixer,
  onOpenSettings,
  onOpenInput,
  session,
  transport,
  capture,
}) {
  const studioActive = activeView === 'decks' || activeView === 'arranger' || mixerOpen;
  const selectMode = (mode) => {
    if (mode === 'mixer') {
      onViewChange('decks');
      onShowMixer();
      return;
    }
    onHideMixer();
    onViewChange(mode);
  };

  return (
    <div className="sd-mobile-shell" aria-label="Songboard mobile controls">
      <header className="sd-mobile-header">
        <button type="button" onClick={() => onViewChange('files')} aria-label="Open projects">
          <FolderOpen size={25} />
        </button>
        <div>
          <strong>SATTARI SONGBOARD</strong>
          <span>{session.sessionName}</span>
        </div>
        <button type="button" onClick={onOpenSettings} aria-label="Open settings">
          <Settings size={25} />
        </button>
      </header>

      {studioActive ? (
        <nav className="sd-mobile-mode-tabs" aria-label="Mobile studio modes">
          {MODES.map(([mode, label]) => {
            const selected = mode === 'mixer' ? mixerOpen : !mixerOpen && activeView === mode;
            return (
              <button
                type="button"
                key={mode}
                className={selected ? 'is-active' : ''}
                aria-current={selected ? 'page' : undefined}
                onClick={() => selectMode(mode)}
              >
                {label}
              </button>
            );
          })}
        </nav>
      ) : null}

      <div className="sd-mobile-capture-dock" aria-label="Mobile transport and capture">
        <small>
          {session.masterBpm} BPM <span>/</span>{' '}
          {capture.captureActive
            ? 'RECORDING'
            : transport.available
              ? 'SESSION READY'
              : 'ADD AUDIO'}
        </small>
        <i aria-hidden="true" />
        <button
          type="button"
          className="sd-mobile-play"
          onClick={transport.onToggle}
          disabled={!transport.available}
          aria-label={transport.playing ? 'Pause session' : 'Play session'}
        >
          {transport.playing ? (
            <Pause size={24} fill="currentColor" />
          ) : (
            <Play size={24} fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          className={`sd-mobile-record${capture.captureActive ? ' is-recording' : ''}`}
          onClick={capture.toggleCapture}
          disabled={capture.captureBusy || !session.restored}
        >
          {capture.captureActive ? <Square size={19} fill="currentColor" /> : <Mic2 size={25} />}
          <span>
            {capture.captureBusy ? 'Saving…' : capture.captureActive ? 'Finish take' : 'Record set'}
          </span>
        </button>
        <button type="button" className="sd-mobile-voice" onClick={onOpenInput}>
          <Mic2 size={23} />
          <span>Voice</span>
        </button>
      </div>

      <nav className="sd-mobile-bottom-nav" aria-label="Songboard mobile sections">
        <button
          type="button"
          className={activeView === 'library' ? 'is-active' : ''}
          aria-current={activeView === 'library' ? 'page' : undefined}
          onClick={() => {
            onHideMixer();
            onViewChange('library');
          }}
        >
          <Library size={25} />
          <span>Bounce</span>
        </button>
        <button
          type="button"
          className={studioActive ? 'is-active' : ''}
          aria-current={studioActive ? 'page' : undefined}
          onClick={() => {
            onHideMixer();
            onViewChange('decks');
          }}
        >
          <Waves size={27} />
          <span>Studio</span>
        </button>
        <button
          type="button"
          className={activeView === 'files' ? 'is-active' : ''}
          aria-current={activeView === 'files' ? 'page' : undefined}
          onClick={() => {
            onHideMixer();
            onViewChange('files');
          }}
        >
          <FolderOpen size={25} />
          <span>Projects</span>
        </button>
      </nav>
    </div>
  );
}
