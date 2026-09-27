import { memo } from 'react';
import { Download, Layers, Redo2, Undo2 } from 'lucide-react';
import StudioAction from '../../components/studio/StudioAction';

/** "Editing & export": clip clipboard, grid, history, playhead and render actions. */
function EditExportPanel({
  detailsRef,
  open,
  selectionCount,
  clipboardCount,
  busy,
  showCancel,
  snap,
  grid,
  canUndo,
  canRedo,
  cursor,
  hasClips,
  commands,
}) {
  return (
    <details
      ref={detailsRef}
      className="ae-edit-tools"
      open={open}
      onToggle={(event) => commands.setMobileTools(event.currentTarget.open)}
    >
      <summary>Editing & export</summary>
      <div
        className="ae-toolbar"
        id="arrangement-timeline-tools"
        role="group"
        aria-label="Editing and export tools"
        data-mobile-open={open}
      >
        <div
          className="ae-actions ae-selection-actions"
          hidden={!selectionCount && !clipboardCount}
        >
          <small>{selectionCount} selected · Shift-click clips to select several</small>
          <button type="button" disabled={busy || !selectionCount} onClick={commands.copyClips}>
            Copy clips
          </button>
          <button type="button" disabled={busy || !clipboardCount} onClick={commands.pasteClips}>
            Paste clips at playhead
          </button>
          <button type="button" disabled={busy || !selectionCount} onClick={commands.deleteClips}>
            Delete selected clips
          </button>
        </div>
        <button type="button" aria-pressed={snap} onClick={commands.toggleSnap}>
          Snap 1/{grid * 4}
        </button>
        <label>
          Grid
          <select
            aria-label="Arrangement grid"
            value={grid}
            onChange={(event) => commands.setGrid(Number(event.target.value))}
          >
            <option value={1}>1/4</option>
            <option value={2}>1/8</option>
            <option value={4}>1/16</option>
            <option value={8}>1/32</option>
          </select>
        </label>
        <StudioAction
          type="button"
          disabled={busy || !canUndo}
          onClick={() => commands.undo()}
          icon={Undo2}
          label="Undo edit"
        />
        <StudioAction
          type="button"
          disabled={busy || !canRedo}
          onClick={() => commands.undo(true)}
          icon={Redo2}
          label="Redo edit"
        />
        <label>
          Playhead (seconds)
          <input
            aria-label="Arrangement playhead seconds"
            type="number"
            min="0"
            step=".01"
            value={Number(cursor.toFixed(2))}
            onChange={(event) => void commands.seek(Number(event.target.value))}
            disabled={busy}
          />
        </label>
        <StudioAction
          type="button"
          disabled={busy || !hasClips}
          onClick={() => void commands.exportAudio(false)}
          icon={Download}
          label="Export mixdown"
        />
        <StudioAction
          type="button"
          disabled={busy || !hasClips}
          onClick={() => void commands.exportAudio(true)}
          icon={Layers}
          label="Export track stems"
        />
        {showCancel && (
          <button type="button" onClick={commands.cancelOperation}>
            Cancel operation
          </button>
        )}
      </div>
    </details>
  );
}

export default memo(EditExportPanel);
