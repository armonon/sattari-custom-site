import { useCallback, useEffect, useState } from 'react';
import { Circle, FolderOpen, HardDrive, ListMusic, Plus, Save } from 'lucide-react';
import { StudioPanel } from '../../components/studio/StudioPanel';
import { formatBytes } from '../session/storageCleanup';

/** Browser storage used by this site, and the cleanup that frees unused audio. */
function StorageSummary({ onCleanUp }) {
  const [estimate, setEstimate] = useState(null);
  const [working, setWorking] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setEstimate((await globalThis.navigator?.storage?.estimate?.()) || null);
    } catch {
      setEstimate(null);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const nearlyFull = estimate?.quota > 0 && estimate.usage / estimate.quota > 0.8;
  return (
    <section className="sd-files-storage" aria-label="Browser storage">
      <header>
        <HardDrive size={16} aria-hidden="true" />
        <span>Browser storage</span>
        <span role="status">
          {estimate?.quota
            ? `${formatBytes(estimate.usage || 0)} used of ${formatBytes(estimate.quota)}`
            : 'Usage unavailable in this browser'}
        </span>
      </header>
      {nearlyFull ? <p>Storage is nearly full. Autosave and exports need free space.</p> : null}
      <button
        type="button"
        disabled={working}
        onClick={async () => {
          setWorking(true);
          try {
            await onCleanUp();
          } finally {
            setWorking(false);
            void refresh();
          }
        }}
      >
        {working ? 'Checking…' : 'Clean up unused audio'}
      </button>
    </section>
  );
}

export default function FilesView({
  sessionName,
  restored,
  recordings,
  onImportSet,
  onOpenProject,
  onSave,
  onNewProject,
  onDownloadRecording,
  onCleanUpStorage,
  backup,
  onDownloadBackup,
  onClearBackup,
  setAside = [],
  onDownloadSetAside,
  onDiscardSetAside,
}) {
  return (
    <StudioPanel panelId="project-files" label="Project files" as="div" className="sd-files-view">
      <header>
        <div>
          <small>Project browser</small>
          <strong>{sessionName}</strong>
        </div>
        <span>{restored ? 'Local session ready' : 'Restoring session…'}</span>
      </header>
      <div className="sd-file-actions">
        <button type="button" onClick={onImportSet}>
          <FolderOpen size={16} />
          <span>Import audio set</span>
          <small>Load up to four tracks into Decks A-D</small>
        </button>
        <button type="button" onClick={onOpenProject}>
          <ListMusic size={16} />
          <span>Open project</span>
          <small>Restore a portable Sattari Studio project</small>
        </button>
        <button type="button" onClick={() => void onSave()}>
          <Save size={16} />
          <span>Save project</span>
          <small>Export decks, mixer state, pads, and notes</small>
        </button>
        <button type="button" onClick={onNewProject}>
          <Plus size={16} />
          <span>New project</span>
          <small>Open a clean four-deck session</small>
        </button>
      </div>
      <section className="sd-files-list">
        <header>
          <span>Local recordings</span>
          <span>
            {recordings.length} {recordings.length === 1 ? 'file' : 'files'}
          </span>
        </header>
        {recordings.length ? (
          recordings.map((recording) => (
            <button type="button" key={recording.id} onClick={() => onDownloadRecording(recording)}>
              <Circle size={10} />
              <strong>{recording.name}</strong>
              <span>{Math.max(1, Math.round(recording.size / 1024))} KB</span>
            </button>
          ))
        ) : (
          <p>No master recordings yet.</p>
        )}
      </section>
      {backup ? (
        <section className="sd-files-list" aria-label="Last project backup">
          <header>
            <span>Last project backup</span>
            <span>{formatBytes(backup.file.size)}</span>
          </header>
          <p>
            {backup.name} stays available here until you save a new backup or clear it. Clear it
            only after the download has finished.
          </p>
          <div className="sd-files-backup-actions">
            <button type="button" onClick={onDownloadBackup}>
              Download again
            </button>
            <button type="button" onClick={onClearBackup}>
              Clear temporary copy
            </button>
          </div>
        </section>
      ) : null}
      {setAside.length ? (
        <section className="sd-files-list" aria-label="Damaged arrangement parts">
          <header>
            <span>Damaged arrangement parts set aside</span>
            <span>{setAside.length}</span>
          </header>
          <p>
            These could not be opened, so they were kept aside instead of blocking the project:{' '}
            {setAside
              .slice(0, 4)
              .map((item) => (item.track ? `${item.name} (${item.track})` : item.name))
              .join(', ')}
            {setAside.length > 4 ? ` and ${setAside.length - 4} more` : ''}. Their audio stays
            stored until you discard them.
          </p>
          <div className="sd-files-backup-actions">
            <button type="button" onClick={onDownloadSetAside}>
              Download as file
            </button>
            <button type="button" onClick={onDiscardSetAside}>
              Discard
            </button>
          </div>
        </section>
      ) : null}
      {onCleanUpStorage ? <StorageSummary onCleanUp={onCleanUpStorage} /> : null}
    </StudioPanel>
  );
}
