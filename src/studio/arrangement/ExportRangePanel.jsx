import { memo, useEffect, useMemo, useState } from 'react';
import { savedExportFiles, clearExportFile } from '../../utils/arrangementStreamExport';
import { offerToLocker } from '../../suite/suiteKit';

export function downloadExport(file, name) {
  offerToLocker(file, name);
  const url = URL.createObjectURL(file),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Export name, optional time range and the finished downloads kept for re-download. */
export function useExportSettings() {
  const [name, setName] = useState('stemdeck'),
    [rangeEnabled, setRangeEnabled] = useState(false),
    [rangeStart, setRangeStart] = useState(0),
    [rangeEnd, setRangeEnd] = useState(30),
    [files, setFiles] = useState([]);
  useEffect(() => {
    let active = true;
    savedExportFiles()
      .then((saved) => {
        // Nothing saved from an earlier visit: no state change, no re-render.
        if (active && saved.length)
          setFiles((currentFiles) => [
            ...currentFiles,
            ...saved
              .filter((file) => !currentFiles.some((entry) => entry.file.name === file.name))
              .map((file) => ({ file, name: file.name })),
          ]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return useMemo(
    () => ({
      name,
      setName,
      rangeEnabled,
      setRangeEnabled,
      rangeStart,
      setRangeStart,
      rangeEnd,
      setRangeEnd,
      files,
      setFiles,
    }),
    [name, rangeEnabled, rangeStart, rangeEnd, files]
  );
}

function ExportRangePanel({ open, busy, selected, settings, onError }) {
  const { setRangeEnabled, setRangeStart, setRangeEnd } = settings;
  return (
    <details className="ae-export-settings" data-mobile-open={open}>
      <summary>Export range & filename</summary>
      <div className="ae-fields">
        <label>
          Export name
          <input value={settings.name} onChange={(event) => settings.setName(event.target.value)} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.rangeEnabled}
            onChange={(event) => setRangeEnabled(event.target.checked)}
          />
          Export time range
        </label>
        <label>
          Export start (s)
          <input
            type="number"
            min="0"
            step=".01"
            value={settings.rangeStart}
            onChange={(event) => setRangeStart(Number(event.target.value))}
          />
        </label>
        <label>
          Export end (s)
          <input
            type="number"
            min="0.001"
            step=".01"
            value={settings.rangeEnd}
            onChange={(event) => setRangeEnd(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            setRangeEnabled(true);
            setRangeStart(selected.start);
            setRangeEnd(selected.start + selected.duration);
          }}
        >
          Use selected clip range
        </button>
      </div>
      <p>
        48 kHz / 24-bit stereo WAV. Track stems are pre-master. Long sets render in sections to
        temporary disk storage. Available disk space and individual source size still apply. Files
        above 4 GiB use RF64 / ZIP64; your destination software must support these formats.
      </p>
      {settings.files.length > 0 && (
        <section aria-label="Export downloads">
          <h3>Export downloads</h3>
          <p>
            Download again if needed. Clear temporary copies only after your download finishes.
            Clearing these files never removes your project or source audio.
          </p>
          {settings.files.map((entry, index) => (
            <div className="ae-fields" key={`${entry.name}-${index}`}>
              <span>
                {entry.name} · {(entry.file.size / 1048576).toFixed(1)} MB
              </span>
              <button type="button" onClick={() => downloadExport(entry.file, entry.name)}>
                Download again
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  try {
                    await clearExportFile(entry.file);
                    settings.setFiles((files) => files.filter((item) => item !== entry));
                  } catch (error) {
                    onError(`Could not clear temporary export: ${error.message}`);
                  }
                }}
              >
                Clear temporary copy
              </button>
            </div>
          ))}
        </section>
      )}
    </details>
  );
}

export default memo(ExportRangePanel);
