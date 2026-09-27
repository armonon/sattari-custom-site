import { memo, useRef } from 'react';
import { bounded } from '../../utils/arrangementModel';

const TABS = [
  ['clip', 'Clip'],
  ['devices', 'Devices'],
  ['automation', 'Track automation'],
  ['piano', 'Piano roll'],
  ['sequencer', 'Sequencer'],
  ['performance', 'Performance'],
];

/** Lower-editor tab strip and the divider that resizes the open editor. */
function EditorTabs({ pianoOpen, lowerEditor, hasSelection, editorHeight, commands }) {
  const resize = useRef(null);
  return (
    <>
      <nav className="ae-editor-tabs" aria-label="Lower editor">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-label={`Show ${label.toLowerCase()} editor`}
            aria-pressed={id === (pianoOpen ? 'piano' : lowerEditor)}
            disabled={id === 'clip' && !hasSelection}
            onClick={() => commands.showEditor(id)}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={commands.closeEditor}>
          Hide editor
        </button>
      </nav>
      {(pianoOpen || lowerEditor !== 'closed') && (
        <div
          className="ae-editor-divider"
          role="separator"
          aria-label="Resize context editor"
          aria-orientation="horizontal"
          aria-valuemin={260}
          aria-valuemax={750}
          aria-valuenow={editorHeight}
          tabIndex={0}
          onKeyDown={(event) => {
            if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              event.stopPropagation();
              commands.setEditorHeight((height) =>
                event.key === 'Home'
                  ? 260
                  : event.key === 'End'
                    ? 750
                    : bounded(height + (event.key === 'ArrowUp' ? 20 : -20), 260, 750)
              );
            }
          }}
          onPointerDown={(event) => {
            resize.current = { y: event.clientY, height: editorHeight };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (resize.current)
              commands.setEditorHeight(
                bounded(resize.current.height + resize.current.y - event.clientY, 260, 750)
              );
          }}
          onPointerUp={() => {
            resize.current = null;
          }}
          onPointerCancel={() => {
            resize.current = null;
          }}
          onLostPointerCapture={() => {
            resize.current = null;
          }}
        />
      )}
    </>
  );
}

export default memo(EditorTabs);
