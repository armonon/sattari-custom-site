import { useState } from 'react';
import { Download, Upload, ShieldCheck } from 'lucide-react';
import { createLearnBackup, inspectLearnBackup, restoreLearnBackup } from './learnBackup';

export default function BackupPanel() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [backup, setBackup] = useState(null),
    [restored, setRestored] = useState(false);
  const perform = async (work) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError(e.message || 'Device storage is unavailable.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="lc-backup">
      <summary>
        <ShieldCheck size={17} /> Keep your practice safe
      </summary>
      <p>
        Download your imported lessons, original audio, prepared audio, progress, guitar setup,
        saved takes and attached videos. Bring the file to another device to continue there.
      </p>
      <p className="lc-subtle">
        Backups stay on your device. Keep the file private if it contains personal recordings. This
        is a manual backup, not automatic synchronization.
      </p>
      <div className="lc-backup-actions">
        <button
          type="button"
          className="loop-button loop-button-secondary"
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              const blob = await createLearnBackup({ progress: setMessage });
              const url = URL.createObjectURL(blob),
                link = document.createElement('a');
              link.href = url;
              link.download = `sattari-learn-${new Date().toISOString().slice(0, 10)}.sattarilearn`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 60000);
              setMessage('Backup prepared. Check your downloads, then keep a copy somewhere safe.');
            })
          }
        >
          <Download size={16} /> Download Learn backup
        </button>
        <label className="loop-button loop-button-secondary lc-file-button">
          <Upload size={16} /> Choose a backup
          <input
            type="file"
            accept=".sattarilearn"
            aria-label="Choose a Learn backup"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              setBackup(null);
              setRestored(false);
              if (file)
                void perform(async () => {
                  const next = await inspectLearnBackup(file, setMessage);
                  setBackup(next);
                  setMessage('Backup verified. Review its contents before restoring.');
                });
            }}
          />
        </label>
      </div>
      {backup && !restored && (
        <div className="lc-backup-review">
          <h3>Ready to bring your practice back.</h3>
          <p>
            {backup.songs.length} imported lessons ·{' '}
            {backup.media.filter((r) => r.kind === 'take').length} takes ·{' '}
            {backup.media.filter((r) => r.kind === 'video').length} videos · {backup.state.length}{' '}
            saved progress and settings entries
          </p>
          <p>
            Missing entries will be added. Existing lessons, recordings and settings on this device
            are kept, including their current progress.
          </p>
          <button
            type="button"
            disabled={busy}
            className="loop-button loop-button-purple"
            onClick={() =>
              void perform(async () => {
                const report = await restoreLearnBackup(backup);
                setRestored(true);
                setMessage(
                  `Restored ${report.songs} ${report.songs === 1 ? 'lesson' : 'lessons'}, ${report.media} media ${report.media === 1 ? 'file' : 'files'} and ${report.settings} settings. ${report.skipped} existing entries kept.`
                );
              })
            }
          >
            Restore missing entries
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {restored && (
        <button
          type="button"
          className="loop-button loop-button-secondary"
          onClick={() => window.location.reload()}
        >
          Open restored library
        </button>
      )}
    </details>
  );
}
