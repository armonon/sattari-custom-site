import { useCallback, useRef, useState } from 'react';
import { repairArrangement } from '../../utils/arrangementModel';

/**
 * Stable callbacks between the page and the always-mounted arrangement editor.
 * Changes made outside the editor go through its applyEdit handle so they are
 * undoable instead of replacing the project (which clears its history).
 */
export function useArrangerBridge({ arrangerRef, actions, activity, showArranger }) {
  const { setArranger, setDecks } = actions;
  const [arrangerPlaying, setArrangerPlaying] = useState(false);
  const editorChanges = useRef(0);

  const onChange = useCallback(
    (project) => {
      editorChanges.current += 1;
      setArranger(project);
    },
    [setArranger]
  );

  const onBusy = useCallback(
    (value) => {
      if (value) activity.loads.add('arranger');
      else activity.loads.delete('arranger');
    },
    [activity]
  );

  const onPlaying = useCallback(
    (value) => {
      setArrangerPlaying(value);
      if (value) setDecks((current) => current.map((deck) => ({ ...deck, playing: false })));
    },
    [setDecks]
  );

  /**
   * Applies `updater(project) => project` as one undoable editor edit. The
   * editor reports applied edits synchronously through onChange; if it
   * declines (busy, not ready, invalid result), the change is applied directly
   * so a recording is never dropped, at the cost of that edit's undo step.
   * That direct path is repaired first: parts that are still invalid are set
   * aside rather than saved, so they can never make the session unopenable.
   */
  const applyEdit = useCallback(
    (updater) => {
      const before = editorChanges.current;
      arrangerRef.current?.applyEdit?.(updater);
      if (editorChanges.current === before)
        setArranger((project) => repairArrangement(updater(project)));
    },
    [arrangerRef, setArranger]
  );

  /** Display-only updates (a take's waveform drawn after it was saved): no undo step. */
  const amendDisplay = useCallback(
    (updater) => {
      if (!arrangerRef.current?.amendDisplay?.(updater)) setArranger(updater);
    },
    [arrangerRef, setArranger]
  );

  /** Mixer gestures: live updates skip history; commitLiveEdit records one step. */
  const updateTrack = useCallback(
    (trackId, updates, live = false) =>
      live
        ? arrangerRef.current?.updateTrack(trackId, updates, { live: true })
        : arrangerRef.current?.updateTrack(trackId, updates),
    [arrangerRef]
  );
  const commitLiveEdit = useCallback(() => arrangerRef.current?.commitLiveEdit?.(), [arrangerRef]);

  const importToArranger = useCallback(
    async (file) => {
      showArranger();
      await arrangerRef.current?.importFiles([file]);
    },
    [arrangerRef, showArranger]
  );

  return {
    arrangerPlaying,
    onChange,
    onBusy,
    onPlaying,
    applyEdit,
    amendDisplay,
    updateTrack,
    commitLiveEdit,
    importToArranger,
  };
}
