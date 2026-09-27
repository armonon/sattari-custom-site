import { Circle, FolderOpen, ListMusic, Plus, Save } from 'lucide-react';
import { StudioPanel } from '../../components/studio/StudioPanel';

export default function FilesView({
  sessionName,
  restored,
  recordings,
  onImportSet,
  onOpenProject,
  onSave,
  onNewProject,
  onDownloadRecording,
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
    </StudioPanel>
  );
}
