// A drag keeps Escape available even when focus sits in a control that would
// otherwise swallow the key. Returns the unsubscribe function.
export function cancelOnEscape(cancel) {
  const listener = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  };
  window.addEventListener('keydown', listener, true);
  return () => window.removeEventListener('keydown', listener, true);
}

/**
 * Makes dragging a range input one history transaction: its changes become a
 * single undo step, and Escape or pointercancel restores the starting project.
 * After Escape, `gestureRef.current.cancelled` stays true until the pointer is released.
 */
export function beginSliderTransaction(event, history, gestureRef) {
  const target = event.target;
  if (event.button !== 0 || target.tagName !== 'INPUT' || target.type !== 'range') return;
  if (gestureRef.current) return;
  const gesture = { cancelled: false };
  gestureRef.current = gesture;
  history.begin();
  const release = () => {
    window.removeEventListener('pointerup', release, true);
    window.removeEventListener('pointercancel', abort, true);
    stopEscape();
    if (gestureRef.current === gesture) gestureRef.current = null;
    history.end();
  };
  const abort = () => {
    history.cancel();
    release();
  };
  const stopEscape = cancelOnEscape(() => {
    gesture.cancelled = true;
    history.cancel();
  });
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', abort, true);
}

/** Timeline shortcuts: zoom (+/−), fit (F), clipboard, undo/redo and Delete on a clip. */
export function handleEditorKey(event, commands, zoom) {
  if (
    /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) ||
    event.target.closest('.ae-notes,.ae-curve')
  )
    return;
  if (!event.metaKey && !event.ctrlKey && ['+', '=', '-', 'f', 'F'].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key.toLowerCase() === 'f') commands.fitTimeline();
    else commands.changeZoom(zoom * (event.key === '-' ? 1 / 1.5 : 1.5));
    return;
  }
  // Shift turns the key into "Z" on most layouts; redo must still match.
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && ['c', 'v', 'x', 'z'].includes(key)) {
    event.preventDefault();
    event.stopPropagation();
    if (key === 'c' || key === 'x') commands.copyClips();
    if (key === 'x') commands.deleteClips();
    if (key === 'v') commands.pasteClips();
    if (key === 'z') commands.undo(event.shiftKey);
  } else if (
    (event.key === 'Delete' || event.key === 'Backspace') &&
    event.target.classList.contains('ae-clip')
  ) {
    event.preventDefault();
    commands.deleteClips();
  }
}
