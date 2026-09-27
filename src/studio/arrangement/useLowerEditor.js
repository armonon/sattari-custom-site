import { useEffect, useState } from 'react';
import { useLatestRef } from './useStableCallback';

/**
 * Which context editor is open below the timeline, and its size. Selecting a
 * clip opens the matching editor unless the beat sequencer is in use.
 */
export function useLowerEditor({ selection, selected, selectedTrackId }) {
  const [lowerEditor, setLowerEditor] = useState('closed'),
    [pianoOpen, setPianoOpen] = useState(false),
    [pianoExpanded, setPianoExpanded] = useState(false),
    [editorHeight, setEditorHeight] = useState(380),
    [rackTrack, setRackTrack] = useState(''),
    [rackReveal, setRackReveal] = useState(0),
    [captureSelection, setCaptureSelection] = useState('');
  const latestEditor = useLatestRef(lowerEditor);
  useEffect(() => {
    if (selectedTrackId) setRackTrack(selectedTrackId);
  }, [selectedTrackId]);
  useEffect(() => {
    if (selected?.kind === 'midi' && latestEditor.current !== 'sequencer') setPianoOpen(true);
    else if (selected?.kind === 'audio') {
      setPianoOpen(false);
      setLowerEditor('clip');
    }
  }, [selection, selected?.kind, latestEditor]);
  return {
    lowerEditor,
    setLowerEditor,
    pianoOpen,
    setPianoOpen,
    pianoExpanded,
    setPianoExpanded,
    editorHeight,
    setEditorHeight,
    rackTrack,
    setRackTrack,
    rackReveal,
    captureSelection,
    setCaptureSelection,
    open: pianoOpen || lowerEditor !== 'closed',
    showRack: () => {
      setLowerEditor('devices');
      setPianoOpen(false);
      setRackReveal((value) => value + 1);
    },
    close: () => {
      setLowerEditor('closed');
      setPianoOpen(false);
      setPianoExpanded(false);
    },
    show: (id) => {
      setLowerEditor(id);
      setPianoOpen(id === 'piano');
    },
    openPerformance: () => {
      setCaptureSelection('');
      setPianoOpen(false);
      setLowerEditor('performance');
    },
  };
}
