import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Plus,
  Piano,
  Upload,
  Play,
  Pause,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  SlidersHorizontal,
  Undo2,
  Redo2,
  Download,
  Layers,
} from 'lucide-react';
import StudioAction from './StudioAction';
import ArrangementNotes from './ArrangementNotes';
import ArrangementSequencer from './ArrangementSequencer';
import ArrangementRack from './ArrangementRack';
import TrackAutomation from './TrackAutomation';
import PerformanceEvents from './PerformanceEvents';
import { reconstructPerformance } from '../../utils/performanceReplay';
import { rackTail } from '../../utils/arrangementEffects';
import AutomationCurve from './AutomationCurve';
import MidiInputRecorder from './MidiInputRecorder';
import { importMidi } from '../../utils/arrangementMidi';
import { recoverSourceCaptures } from '../../utils/sourceCapture';
import { journalStore } from '../../utils/performanceJournal';
import { PerformancePlayer } from '../../utils/performancePlayer';
import { ArrangementEngine } from '../../utils/arrangementEngine';
import { savedExportFiles, clearExportFile } from '../../utils/arrangementStreamExport';
import { INSTRUMENTS } from '../../utils/arrangementInstruments';
import { ghostNotes } from '../../utils/arrangementNotes';
import { analyzeAudioFile, createWaveformPeaks } from '../../utils/audioAnalysis';
import { getAudioAsset, putAudioAsset } from '../../utils/audioProjectStore';
import {
  audioClip,
  audioTrack,
  arrangementDuration,
  arrangementId,
  bounded,
  migrateArrangement,
  rulerMarks,
  splitClip,
  validateArrangement,
  resizeClip,
  trimClipStart,
  clipWaveform,
  clipRows,
  retimeMidi,
  arrangementGridPixels,
  compRegion,
  repeatLinkedPattern,
  updatePatternClip,
  moveClips,
} from '../../utils/arrangementModel';
import { droppedLibraryFiles, isLibraryAudio } from '../../utils/musicLibrary';
import './ArrangementEditor.css';
import './ArrangementWorkspace.css';
import { MASTER_STEMS } from '../../utils/masterOutput';

const clone = (value) => JSON.parse(JSON.stringify(value));
function downloadExport(file, name) {
  const url = URL.createObjectURL(file),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function ArrangementEditor(
  {
    project,
    onChange,
    getEngine,
    bpm,
    master,
    decks,
    visible,
    onBusy,
    onPlaying,
    ready = true,
    recordings = [],
  },
  ref
) {
  const [selection, setSelection] = useState(null),
    [chosen, setChosen] = useState([]),
    [cursor, setCursor] = useState(0),
    [playing, setPlaying] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      'Import audio, add an instrument, or copy deck audio into independent tracks.'
    );
  const [zoom, setZoom] = useState(40),
    [timelineView, setTimelineView] = useState({ left: 0, width: 1400 }),
    [snap, setSnap] = useState(true),
    [target, setTarget] = useState('volume'),
    [pointTime, setPointTime] = useState(0),
    [pointValue, setPointValue] = useState(100);
  const [grid, setGrid] = useState(4),
    [follow, setFollow] = useState(true),
    [mobileTools, setMobileTools] = useState(false),
    [dragPreview, setDragPreview] = useState(null);
  const [loopEnabled, setLoopEnabled] = useState(false),
    [loopStart, setLoopStart] = useState(0),
    [loopEnd, setLoopEnd] = useState(8),
    [midiCaptureActive, setMidiCaptureActive] = useState(false);
  const midiInput = useRef(null);
  const [recoveries, setRecoveries] = useState([]);
  const [eventRecoveries, setEventRecoveries] = useState([]);
  const performancePlayer = useRef(null);
  const [activeReplay, setActiveReplay] = useState(null);
  const [captureSelection, setCaptureSelection] = useState('');
  const exportTools = useRef(null);
  useEffect(() => () => performancePlayer.current?.dispose(), []);
  const replayPerformance = async (capture, record = false, options = {}) => {
    if (busy) return;
    engine.current?.pause();
    setPlaying(false);
    setBusy(true);
    performancePlayer.current?.dispose();
    const player = new PerformancePlayer(getEngine(), {
      onStatus: setMessage,
      onFinish: ({ sources, error, lateEvents, maxLateness, offset }) => {
        if (!error && sources?.tracks?.length)
          edit((next) => {
            for (const row of sources.tracks.filter((track) => track.role === 'reference')) {
              const clips = row.clips.flatMap((clip) => {
                const start = clip.start - offset,
                  trim = Math.max(0, -start);
                const duration = Math.min(
                  clip.duration - trim,
                  capture.duration - Math.max(0, start)
                );
                return duration > 0
                  ? [
                      {
                        ...clip,
                        start: Math.max(0, start) + (capture.timelineStart || 0),
                        offset: (clip.offset || 0) + trim,
                        duration,
                      },
                    ]
                  : [];
              });
              next.tracks.push({
                ...row,
                name: `${capture.name} · edited performance`,
                muted: true,
                offline: false,
                clips,
              });
            }
            return next;
          });
        setMessage(
          error?.message ||
            `${sources ? 'Edited performance printed, muted for comparison. ' : 'Replay finished. '}Late control events (>25 ms): ${lateEvents || 0}; worst ${(1000 * (maxLateness || 0)).toFixed(1)} ms. ${sources?.error || ''}`
        );
        setBusy(false);
        setActiveReplay(null);
        player.dispose();
      },
    });
    performancePlayer.current = player;
    try {
      await player.prepare(capture, current.current.tracks, options);
      setActiveReplay(capture.id || capture.assetId);
      await player.play({ record });
    } catch (error) {
      player.dispose();
      setBusy(false);
      setActiveReplay(null);
      setMessage(error.message);
    }
  };
  const rackPanel = useRef(null);
  const lowerPanel = useRef(null);
  const [rackTrack, setRackTrack] = useState('');
  const [rackReveal, setRackReveal] = useState(0);
  const [lowerEditor, setLowerEditor] = useState('closed');
  const lowerEditorRef = useRef(lowerEditor);
  lowerEditorRef.current = lowerEditor;
  const showRack = () => {
    setLowerEditor('devices');
    setPianoOpen(false);
    setRackReveal((value) => value + 1);
  };
  const [exportFiles, setExportFiles] = useState([]);
  useEffect(() => {
    let active = true;
    savedExportFiles()
      .then((files) => {
        if (active)
          setExportFiles((currentFiles) => [
            ...currentFiles,
            ...files
              .filter((file) => !currentFiles.some((entry) => entry.file.name === file.name))
              .map((file) => ({ file, name: file.name })),
          ]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [pianoOpen, setPianoOpen] = useState(false),
    [pianoExpanded, setPianoExpanded] = useState(false),
    [editorHeight, setEditorHeight] = useState(380);
  const editorResize = useRef(null);
  const closeEditor = () => {
    setLowerEditor('closed');
    setPianoOpen(false);
    setPianoExpanded(false);
  };
  const sampleInput = useRef(null);
  const [compStart, setCompStart] = useState(null),
    [compEnd, setCompEnd] = useState(null);
  useEffect(() => {
    setCompStart(null);
    setCompEnd(null);
  }, [selection]);
  const scroll = useRef(null),
    zoomScroll = useRef(null),
    gesture = useRef(null),
    priorTempo = useRef(bpm);
  useLayoutEffect(() => {
    if (zoomScroll.current !== null && scroll.current) {
      scroll.current.scrollLeft = zoomScroll.current;
      zoomScroll.current = null;
    }
  }, [zoom]);
  useEffect(() => {
    const element = scroll.current;
    if (!element || !visible) return undefined;
    const measure = () =>
      setTimelineView({ left: element.scrollLeft, width: element.clientWidth || 1400 });
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);
  const clipboard = useRef([]);
  const suppressClipClick = useRef(false);
  const [rangeEnabled, setRangeEnabled] = useState(false),
    [rangeStart, setRangeStart] = useState(0),
    [rangeEnd, setRangeEnd] = useState(30),
    [exportName, setExportName] = useState('stemdeck');
  const layouts = useMemo(
    () => new Map(project.tracks.map((track) => [track.id, clipRows(track.clips)])),
    [project.tracks]
  );
  const waveforms = useMemo(
    () =>
      new Map(
        project.tracks.flatMap((track) =>
          track.clips.map((clip) => [
            clip.id,
            clipWaveform(clip)
              .map(
                (value, i, array) =>
                  `${(i / Math.max(1, array.length - 1)) * 100},${10 - Math.min(10, Math.abs(value) / 10)}`
              )
              .join(' '),
          ])
        )
      ),
    [project.tracks]
  );
  const input = useRef(null),
    relinkInput = useRef(null),
    relinkTarget = useRef(null),
    importTarget = useRef(null),
    engine = useRef(null),
    engineOwner = useRef(null),
    current = useRef(project),
    settings = useRef(master),
    history = useRef({ undo: [], redo: [] }),
    cancelled = useRef(false),
    mounted = useRef(true),
    working = useRef(false),
    position = useRef(0),
    moving = useRef(null);
  // A restored project or newly finished recording arrives outside this editor.
  // Old whole-project undo snapshots must never erase those new audio lanes.
  const externalProjectChange = project !== current.current;
  if (externalProjectChange) history.current = { undo: [], redo: [] };
  current.current = project;
  settings.current = master;
  const masterKey = JSON.stringify(master);
  useEffect(() => {
    engine.current?.setMasterSettings(settings.current);
  }, [masterKey]);
  const getArrangementEngine = useCallback(() => {
    const owner = getEngine();
    if (owner !== engineOwner.current) {
      engine.current?.dispose();
      engineOwner.current = owner;
      engine.current = new ArrangementEngine(
        owner.getAudioContext(),
        owner.output,
        owner.master
          ? {
              input: owner.master,
              reduction: () => Math.max(0, -(owner.masterCompressor?.reduction || 0)),
            }
          : null
      );
      owner.arrangementReduction = () => engine.current?.getReduction?.() || 0;
    }
    return engine.current;
  }, [getEngine]);
  const setPosition = (value) => {
    position.current = value;
    setCursor(value);
  };
  const pause = useCallback(() => {
    if (engine.current) {
      const value = engine.current.pause();
      position.current = value;
      setCursor(value);
    }
    setPlaying(false);
    onPlaying(false);
  }, [onPlaying]);
  const syncPlayback = useCallback(
    (next, mixOnly = false) => {
      if (!engine.current) return;
      engine.current.updateMix?.(next);
      if (mixOnly || !engine.current.playing) return;
      void engine.current.revise(next).catch((error) => {
        if (!mounted.current || current.current !== next) return;
        pause();
        setMessage(`Edit saved; playback stopped: ${error.message}`);
      });
    },
    [pause]
  );
  useEffect(() => {
    const previous = priorTempo.current;
    priorTempo.current = bpm;
    if (previous === bpm || externalProjectChange) return;
    const next = retimeMidi(current.current, previous, bpm);
    try {
      validateArrangement(next);
    } catch (error) {
      setMessage(error.message);
      return;
    }
    history.current.undo.push(current.current);
    history.current.redo = [];
    current.current = next;
    syncPlayback(next);
    onChange(next);
  }, [bpm, onChange, syncPlayback, externalProjectChange]);
  const toggle = async () => {
    if (working.current || !ready) return;
    if (engine.current?.playing) {
      pause();
      return;
    }
    working.current = true;
    cancelled.current = false;
    onBusy(true);
    setBusy(true);
    try {
      const live = getEngine();
      live.pauseAll();
      await live.unlock();
      if (cancelled.current || !mounted.current) return;
      const arrangement = getArrangementEngine();
      const start = position.current >= arrangementDuration(current.current) ? 0 : position.current;
      const started = loopEnabled
        ? await arrangement.play(current.current, start, settings.current, {
            start: loopStart,
            end: loopEnd,
          })
        : await arrangement.play(current.current, start, settings.current);
      if (!mounted.current) return;
      setPosition(loopEnabled ? arrangement.position() : start);
      setPlaying(started);
      onPlaying(started);
      setMessage(started ? 'Playing · Audio-clock scheduling' : 'No clips after the playhead.');
    } catch (error) {
      if (mounted.current) setMessage(error.message);
    } finally {
      working.current = false;
      onBusy(false);
      if (mounted.current) setBusy(false);
    }
  };
  useImperativeHandle(ref, () => ({
    updateTrack: (id, updates) =>
      edit((next) => ({
        ...next,
        tracks: next.tracks.map((track) => (track.id === id ? { ...track, ...updates } : track)),
      })),
    openPerformance: () => {
      setCaptureSelection('');
      setPianoOpen(false);
      setLowerEditor('performance');
    },
    openExport: () => {
      setMobileTools(true);
      exportTools.current?.scrollIntoView?.({ block: 'nearest' });
    },
    toggle,
    pause,
    getPosition: () => (engine.current?.playing ? engine.current.position() : position.current),
    importFiles: (files) => addFiles(Promise.resolve(files.map((file) => ({ file })))),
    importAudio: () => {
      if (working.current || !ready) return;
      importTarget.current = null;
      input.current?.click();
    },
    undo: (redo) => undo(redo),
    reset: () => {
      engine.current?.stop();
      setPosition(0);
      setPlaying(false);
      onPlaying(false);
      history.current = { undo: [], redo: [] };
      setSelection(null);
      setChosen([]);
      clipboard.current = [];
      setLoopEnabled(false);
    },
  }));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
      engine.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!playing) return undefined;
    let frame,
      previous = 0,
      readoutAt = 0;
    const tick = (timestamp) => {
      if (timestamp - previous > 50) {
        previous = timestamp;
        const value = engine.current.position();
        if (engine.current.error) {
          setMessage(engine.current.error);
          pause();
          return;
        }
        position.current = value;
        if (visible) {
          scroll.current?.style.setProperty('--ae-playhead-x', `${value * zoom}px`);
          if (timestamp - readoutAt > 250) {
            setCursor(value);
            readoutAt = timestamp;
          }
        }
        if (visible && follow && scroll.current) {
          const x = value * zoom;
          if (
            x > scroll.current.scrollLeft + scroll.current.clientWidth - 260 ||
            x < scroll.current.scrollLeft
          )
            scroll.current.scrollLeft = Math.max(0, x - 60);
        }
        if (value >= engine.current.end) {
          pause();
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, visible, pause, follow, zoom]);
  const edit = (updater, live = false, mixOnly = false) => {
    if (working.current || !ready) return;
    const before = current.current,
      after =
        typeof updater === 'function'
          ? updater(live ? { ...before, tracks: [...before.tracks] } : clone(before))
          : updater;
    try {
      validateArrangement(after);
      // Prepare supported insert changes before committing history. Failed
      // preparation leaves both the audible graph and saved project intact.
      if (mixOnly) syncPlayback(after, true);
    } catch (error) {
      setMessage(error.message);
      return;
    }
    history.current.undo.push(before);
    history.current.undo = history.current.undo.slice(-60);
    history.current.redo = [];
    current.current = after;
    if (!mixOnly) syncPlayback(after);
    onChange(after);
  };
  const selectedTrack = project.tracks.find((track) =>
    track.clips.some((clip) => clip.id === selection)
  );
  const selected = selectedTrack?.clips.find((clip) => clip.id === selection);
  const selectedTrackId = selectedTrack?.id;
  useEffect(() => {
    if (selectedTrackId) setRackTrack(selectedTrackId);
  }, [selectedTrackId]);
  useEffect(() => {
    if (selected?.kind === 'midi' && lowerEditorRef.current !== 'sequencer') setPianoOpen(true);
    else if (selected?.kind === 'audio') {
      setPianoOpen(false);
      setLowerEditor('clip');
    }
  }, [selection, selected?.kind]);
  const ghosts = useMemo(
    () => (selected?.kind === 'midi' ? ghostNotes(project, selected) : []),
    [project, selected]
  );
  const viewportWidth = () =>
    Math.max(
      180,
      (scroll.current?.clientWidth || 1000) -
        (scroll.current?.querySelector('.ae-ruler > span')?.offsetWidth || 220)
    );
  const changeZoom = (requested) => {
    const next = bounded(requested, 0.1, 400, zoom),
      left = scroll.current?.scrollLeft || 0,
      viewWidth = viewportWidth(),
      x = position.current * zoom - left,
      anchor = x >= 0 && x <= viewWidth ? x : viewWidth / 2;
    zoomScroll.current = Math.max(0, ((left + anchor) / zoom) * next - anchor);
    setZoom(next);
  };
  const fitTimeline = (selectionOnly = false) => {
    const clips = project.tracks
      .flatMap((track) => track.clips)
      .filter((clip) => !selectionOnly || (chosen.length ? chosen : [selection]).includes(clip.id));
    const start =
        selectionOnly && clips.length
          ? clips.reduce((value, clip) => Math.min(value, clip.start), Infinity)
          : 0,
      end = clips.reduce((value, clip) => Math.max(value, clip.start + clip.duration), start),
      next = bounded(
        (viewportWidth() - 40) / Math.max(0.1, end - start || (16 * 240) / bpm),
        0.1,
        400
      );
    zoomScroll.current = Math.max(0, start * next - 20);
    if (next === zoom && scroll.current) scroll.current.scrollLeft = zoomScroll.current;
    setZoom(next);
  };
  const selectionIds = (chosen.length ? chosen : selection ? [selection] : []).filter((id) =>
    project.tracks.some((track) => track.clips.some((clip) => clip.id === id))
  );
  const copyClips = () => {
    clipboard.current = project.tracks.flatMap((track) =>
      track.clips
        .filter((clip) => selectionIds.includes(clip.id))
        .map((clip) => ({ trackId: track.id, clip: clone(clip) }))
    );
    setMessage(`${clipboard.current.length} clips copied. Paste places them at the playhead.`);
  };
  const deleteClips = () => {
    edit((next) => ({
      ...next,
      tracks: next.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => !selectionIds.includes(clip.id)),
      })),
    }));
    setSelection(null);
    setChosen([]);
  };
  const pasteClips = () => {
    if (!clipboard.current.length) return;
    const first = Math.min(...clipboard.current.map(({ clip }) => clip.start));
    edit((next) => {
      for (const { trackId, clip } of clipboard.current) {
        let track = next.tracks.find((row) => row.id === trackId);
        if (!track) {
          track = audioTrack('Pasted clips');
          track.id = trackId;
          next.tracks.push(track);
        }
        track.clips.push({
          ...clone(clip),
          patternId: undefined,
          id: arrangementId(),
          start: position.current + clip.start - first,
        });
      }
      return next;
    });
  };
  const changeClip = (updates) =>
    edit((next) => {
      return updatePatternClip(next, selection, {
        ...updates,
        ...('fadeIn' in updates && !('fadeInCurve' in updates) ? { fadeInCurve: undefined } : {}),
        ...('fadeOut' in updates && !('fadeOutCurve' in updates)
          ? { fadeOutCurve: undefined }
          : {}),
      });
    });
  const changeTrack = (id, updates, mixOnly = false) =>
    edit(
      (next) => ({
        ...next,
        tracks: next.tracks.map((track) => (track.id === id ? { ...track, ...updates } : track)),
      }),
      true,
      mixOnly
    );
  const undo = (redo = false) => {
    if (working.current) return;
    const source = redo ? history.current.redo : history.current.undo,
      destination = redo ? history.current.undo : history.current.redo;
    const item = source.pop();
    if (item) {
      const mixOnly =
        item.tracks.length === current.current.tracks.length &&
        item.tracks.every((track, index) => {
          const previous = current.current.tracks[index];
          return track.id === previous.id && track.clips === previous.clips;
        });
      try {
        if (mixOnly) syncPlayback(item, true);
      } catch (error) {
        source.push(item);
        setMessage(error.message);
        return;
      }
      destination.push(current.current);
      current.current = item;
      if (!mixOnly) syncPlayback(item);
      onChange(item);
    }
  };
  const seek = async (seconds) => {
    if (working.current) return;
    const value = Math.max(0, seconds),
      wasPlaying = engine.current?.playing;
    pause();
    setPosition(value);
    if (wasPlaying) await toggle();
  };
  const snapped = (seconds) =>
    snap ? Math.round(seconds / (60 / bpm / grid)) * (60 / bpm / grid) : seconds;
  const addFiles = async (entries, trackId = null, at = position.current) => {
    if (working.current || !ready) return;
    pause();
    working.current = true;
    onBusy(true);
    setBusy(true);
    cancelled.current = false;
    const before = current.current,
      next = clone(before);
    let count = 0,
      failed = 0;
    try {
      for (const { file } of await entries) {
        if (cancelled.current) break;
        if (/\.(mid|midi)$/i.test(file.name)) {
          try {
            const imported = importMidi(await file.arrayBuffer(), {
              bpm,
              start: at,
              name: file.name.replace(/\.[^.]+$/, ''),
            });
            next.tracks.push(...imported.tracks);
            count += imported.tracks.length;
          } catch (error) {
            failed++;
            setMessage(error.message);
          }
          continue;
        }
        if (!isLibraryAudio(file)) continue;
        setMessage(`Importing ${file.name}…`);
        try {
          const analysis = await analyzeAudioFile(file),
            asset = await putAudioAsset(file, { name: file.name, analysis });
          if (
            !Number.isFinite(analysis.duration) ||
            analysis.duration < 0.001 ||
            analysis.duration > 86400
          )
            throw new Error('Unsupported audio duration.');
          const track =
            next.tracks.find((item) => item.id === trackId) ||
            audioTrack(file.name.replace(/\.[^.]+$/, ''));
          if (!next.tracks.includes(track)) next.tracks.push(track);
          const clip = {
            ...audioClip(asset.id, file.name, analysis.duration, at),
            waveform: analysis.waveform,
          };
          track.clips.push(clip);
          count++;
          if (trackId) at += analysis.duration;
        } catch {
          failed++;
        }
      }
      if (mounted.current && count) {
        // A live take can finish while files decode. Preserve that newly added
        // track and its event log rather than replacing it with the import snapshot.
        const latest = current.current;
        next.captures = latest.captures;
        const originalIds = new Set(before.tracks.map((track) => track.id));
        next.tracks.push(...latest.tracks.filter((track) => !originalIds.has(track.id)));
        history.current.undo.push(latest);
        history.current.redo = [];
        current.current = next;
        onChange(next);
      }
      if (mounted.current)
        setMessage(
          `${count} clips imported · ${failed} failed. MIDI follows project tempo with built-in voices; tempo maps, programs and unsupported controllers are not imported.`
        );
    } catch (error) {
      if (mounted.current) setMessage(error.message);
    } finally {
      working.current = false;
      onBusy(false);
      if (mounted.current) setBusy(false);
    }
  };
  const addMidi = (instrument = 'piano') => {
    if (typeof instrument !== 'string') instrument = 'piano';
    if (instrument !== 'drums') setPianoOpen(true);
    const track = audioTrack(instrument === 'drums' ? 'Drums' : 'Instrument');
    track.kind = 'midi';
    const clip = {
      ...audioClip(
        '',
        instrument === 'drums' ? 'Beat pattern' : 'Instrument pattern',
        240 / bpm,
        position.current
      ),
      kind: 'midi',
      timebase: 'beats',
      instrument,
      notes: [],
    };
    track.clips.push(clip);
    edit((next) => ({ ...next, tracks: [...next.tracks, track] }));
    setSelection(clip.id);
    setChosen([clip.id]);
  };
  const openSequencer = () => {
    setLowerEditor('sequencer');
    setPianoOpen(false);
    if (selected?.kind === 'midi' && selected.instrument === 'drums') return;
    const drum = project.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.kind === 'midi' && clip.instrument === 'drums');
    if (drum) {
      setSelection(drum.id);
      setChosen([drum.id]);
    } else addMidi('drums');
  };
  const addMidiPattern = (trackId, at = position.current) => {
    const clip = {
      ...audioClip('', 'Instrument pattern', 240 / bpm, Math.max(0, at)),
      kind: 'midi',
      timebase: 'beats',
      instrument:
        project.tracks
          .find((track) => track.id === trackId)
          ?.clips.find((clip) => clip.kind === 'midi')?.instrument || 'piano',
      assetId:
        project.tracks
          .find((track) => track.id === trackId)
          ?.clips.find((clip) => clip.kind === 'midi')?.assetId || '',
      sampleRoot:
        project.tracks
          .find((track) => track.id === trackId)
          ?.clips.find((clip) => clip.kind === 'midi')?.sampleRoot || 'C4',
      instrumentSettings: clone(
        project.tracks
          .find((track) => track.id === trackId)
          ?.clips.find((clip) => clip.kind === 'midi')?.instrumentSettings || {}
      ),
      notes: [],
    };
    edit((next) => {
      next.tracks.find((track) => track.id === trackId)?.clips.push(clip);
      return next;
    });
    setSelection(clip.id);
    setChosen([clip.id]);
  };
  const addTake = async (recording) => {
    if (working.current || !ready) return;
    pause();
    working.current = true;
    onBusy(true);
    setBusy(true);
    cancelled.current = false;
    try {
      const asset = await getAudioAsset(recording.id);
      if (!asset?.blob)
        throw new Error('Recorded audio is missing. Restore its portable project backup.');
      const decoded = await getEngine()
        .getAudioContext()
        .rawContext.decodeAudioData(await asset.blob.arrayBuffer());
      if (cancelled.current || !mounted.current) return;
      const track = audioTrack(recording.name);
      track.role = 'reference';
      track.clips.push({
        ...audioClip(recording.id, recording.name, decoded.duration, position.current),
        waveform: createWaveformPeaks(decoded.getChannelData(0), 2048),
      });
      working.current = false;
      edit((next) => ({
        ...next,
        tracks: [
          ...next.tracks.map((row) => (row.role === 'reference' ? { ...row, muted: true } : row)),
          track,
        ],
      }));
      setMessage('Recorded take added as an editable audio lane. Its original audio is unchanged.');
    } catch (error) {
      if (mounted.current) setMessage(error.message);
    } finally {
      working.current = false;
      onBusy(false);
      if (mounted.current) setBusy(false);
    }
  };
  const exportAudio = async (stems) => {
    if (working.current) return;
    pause();
    working.current = true;
    onBusy(true);
    setBusy(true);
    cancelled.current = false;
    try {
      const blob = await getArrangementEngine().export(
        current.current,
        settings.current,
        stems,
        setMessage,
        () => cancelled.current,
        rangeEnabled ? { start: rangeStart, end: rangeEnd } : null
      );
      if (!mounted.current) return;
      const name = exportName.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'stemdeck';
      const filename = stems ? `${name}-track-stems.zip` : `${name}-mixdown.wav`;
      setExportFiles((files) => [...files, { file: blob, name: filename }]);
      downloadExport(blob, filename);
      setMessage(
        stems
          ? 'Stem ZIP download requested · 48 kHz / 24-bit · aligned pre-master track stems.'
          : 'Mixdown download requested · 48 kHz / 24-bit WAV · includes master processing.'
      );
    } catch (error) {
      if (mounted.current) setMessage(error.message);
    } finally {
      working.current = false;
      onBusy(false);
      if (mounted.current) setBusy(false);
    }
  };
  const relinkFile = async (file, assetId) => {
    if (!file || busy || !ready) return;
    pause();
    working.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const analysis = await analyzeAudioFile(file);
      const needed = Math.max(
        0,
        ...current.current.tracks.flatMap((track) =>
          track.clips
            .filter((clip) => clip.assetId === assetId)
            .map((clip) => clip.offset + clip.duration * clip.rate)
        )
      );
      if (analysis.duration + 0.001 < needed)
        throw new Error(`Replacement must contain at least ${needed.toFixed(2)} seconds of audio.`);
      const asset = await putAudioAsset(file, { name: file.name, analysis });
      if (!mounted.current) return;
      working.current = false;
      edit((next) => ({
        ...next,
        tracks: next.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.assetId !== assetId
              ? clip
              : {
                  ...clip,
                  assetId: asset.id,
                  sourceDuration: analysis.duration,
                  waveform: analysis.waveform,
                }
          ),
        })),
      }));
      setMessage(
        'Source relinked for every matching clip. Re-enable offline tracks when all their sources are restored.'
      );
    } catch (error) {
      if (mounted.current) setMessage(error.message);
    } finally {
      working.current = false;
      onBusy(false);
      if (mounted.current) setBusy(false);
    }
  };
  const duration = Math.max(
      (16 * 240) / bpm,
      arrangementDuration(project) + rackTail(master.processing?.effects) + 240 / bpm
    ),
    width = Math.max(600, duration * zoom);
  return (
    <section
      hidden={!visible}
      className="sd-arrangement-editor ae-workspace-focused"
      data-editor-open={pianoOpen || lowerEditor !== 'closed'}
      style={{ '--editor-height': `${editorHeight}px` }}
      aria-label="Multitrack arrangement"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) ||
          event.target.closest('.ae-notes,.ae-curve')
        )
          return;
        if (!event.metaKey && !event.ctrlKey && ['+', '=', '-', 'f', 'F'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          if (event.key.toLowerCase() === 'f') fitTimeline();
          else changeZoom(zoom * (event.key === '-' ? 1 / 1.5 : 1.5));
          return;
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          ['c', 'v', 'x', 'z'].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
          event.stopPropagation();
          const key = event.key.toLowerCase();
          if (key === 'c' || key === 'x') copyClips();
          if (key === 'x') deleteClips();
          if (key === 'v') pasteClips();
          if (key === 'z') undo(event.shiftKey);
        } else if (
          (event.key === 'Delete' || event.key === 'Backspace') &&
          event.target.classList.contains('ae-clip')
        ) {
          event.preventDefault();
          deleteClips();
        }
      }}
    >
      <header className="ae-main-header">
        <div>
          <h3>Arrangement</h3>
          <small>
            {project.tracks.length} tracks · {bpm} BPM · 4/4
          </small>
        </div>
        <div className="ae-actions">
          <StudioAction
            type="button"
            className="ae-play-button"
            icon={playing ? Pause : Play}
            label={playing ? 'Pause' : 'Play'}
            onClick={toggle}
            disabled={busy || !project.tracks.some((track) => track.clips.length)}
            aria-label={playing ? 'Pause arrangement' : 'Play arrangement'}
          />
          <StudioAction
            type="button"
            icon={Square}
            label="Stop"
            onClick={() => {
              pause();
              engine.current?.stop();
              setPosition(0);
            }}
            disabled={busy}
          />
          <StudioAction
            type="button"
            icon={Upload}
            label="Import audio"
            onClick={() => {
              importTarget.current = null;
              input.current?.click();
            }}
            disabled={busy}
          />
          <StudioAction
            type="button"
            icon={Plus}
            label="Add audio track"
            onClick={() => edit((next) => ({ ...next, tracks: [...next.tracks, audioTrack()] }))}
            disabled={busy}
          />
          <StudioAction icon={Piano} label="Add instrument" onClick={addMidi} disabled={busy} />
          <StudioAction icon={SlidersHorizontal} label="Effects rack" onClick={showRack} />
          <button
            type="button"
            aria-expanded={pianoOpen}
            aria-controls="arrangement-piano-dock"
            onClick={() => {
              if (!pianoOpen && selected?.kind !== 'midi') {
                const first = project.tracks
                  .flatMap((track) => track.clips)
                  .find((clip) => clip.kind === 'midi');
                if (first) {
                  setSelection(first.id);
                  setChosen([first.id]);
                }
              }
              setPianoOpen(!pianoOpen);
            }}
          >
            Piano roll
          </button>
          <button
            type="button"
            disabled={busy || !ready}
            aria-pressed={!pianoOpen && lowerEditor === 'sequencer'}
            onClick={openSequencer}
          >
            Beat sequencer
          </button>
          <details className="ae-more-sources">
            <summary>More sources</summary>
            <div>
              <button type="button" disabled={busy} onClick={() => midiInput.current?.click()}>
                Import MIDI
              </button>
              <button
                type="button"
                disabled={busy || !decks.some((deck) => deck.duration)}
                onClick={() => {
                  const imported = migrateArrangement({ decks });
                  edit((next) => ({ ...next, tracks: [...next.tracks, ...imported.tracks] }));
                  setMessage(
                    'Copied deck source audio and clip edits. Live deck FX are not baked into these copies; record a take to preserve the performed sound.'
                  );
                }}
              >
                Copy deck audio
              </button>
            </div>
          </details>
        </div>
      </header>
      <div className="ae-navigation" aria-label="Timeline navigation">
        <div className="ae-time-display">
          <span>POSITION</span>
          <output aria-label="Playhead bars and beats">
            {Math.floor((cursor * bpm) / 240) + 1}
            <em> : </em>
            {(Math.floor((cursor * bpm) / 60) % 4) + 1}
          </output>
          <small>
            {Math.floor(cursor / 60)}:{(cursor % 60).toFixed(1).padStart(4, '0')}
          </small>
        </div>
        <div className="ae-zoom-controls" role="group" aria-label="Timeline zoom controls">
          <button
            type="button"
            aria-label="Zoom out timeline"
            title="Zoom out (−)"
            disabled={zoom <= 0.1}
            onClick={() => changeZoom(zoom / 1.5)}
          >
            <ZoomOut size={17} aria-hidden="true" />
          </button>
          <input
            type="range"
            aria-label="Timeline zoom"
            aria-valuetext={`${Math.round((zoom / 40) * 100)} percent`}
            min={Math.log2(0.1)}
            max={Math.log2(400)}
            step="0.05"
            value={Math.log2(zoom)}
            onChange={(event) => changeZoom(2 ** Number(event.target.value))}
          />
          <button
            type="button"
            aria-label="Zoom in timeline"
            title="Zoom in (+)"
            disabled={zoom >= 400}
            onClick={() => changeZoom(zoom * 1.5)}
          >
            <ZoomIn size={17} aria-hidden="true" />
          </button>
          <StudioAction
            type="button"
            onClick={() => fitTimeline()}
            title="Show the whole arrangement (F)"
            icon={Maximize2}
            label="Fit project"
          />
          <StudioAction
            icon={Crosshair}
            label="Fit selection"
            disabled={!selected}
            onClick={() => fitTimeline(true)}
          />
        </div>
        <button type="button" aria-pressed={follow} onClick={() => setFollow(!follow)}>
          Follow playhead
        </button>
      </div>
      <div className="ae-project-tools">
        <details
          ref={exportTools}
          className="ae-edit-tools"
          open={mobileTools}
          onToggle={(event) => setMobileTools(event.currentTarget.open)}
        >
          <summary>Editing & export</summary>
          <div
            className="ae-toolbar"
            id="arrangement-timeline-tools"
            data-mobile-open={mobileTools}
          >
            <div
              className="ae-actions ae-selection-actions"
              hidden={!selectionIds.length && !clipboard.current.length}
            >
              <small>{selectionIds.length} selected · Shift-click clips to select several</small>
              <button type="button" disabled={busy || !selectionIds.length} onClick={copyClips}>
                Copy clips
              </button>
              <button
                type="button"
                disabled={busy || !clipboard.current.length}
                onClick={pasteClips}
              >
                Paste clips at playhead
              </button>
              <button type="button" disabled={busy || !selectionIds.length} onClick={deleteClips}>
                Delete selected clips
              </button>
            </div>
            <button type="button" aria-pressed={snap} onClick={() => setSnap(!snap)}>
              Snap 1/{grid * 4}
            </button>
            <label>
              Grid
              <select
                aria-label="Arrangement grid"
                value={grid}
                onChange={(event) => setGrid(Number(event.target.value))}
              >
                <option value={1}>1/4</option>
                <option value={2}>1/8</option>
                <option value={4}>1/16</option>
                <option value={8}>1/32</option>
              </select>
            </label>
            <StudioAction
              type="button"
              disabled={busy || !history.current.undo.length}
              onClick={() => undo()}
              icon={Undo2}
              label="Undo edit"
            />
            <StudioAction
              type="button"
              disabled={busy || !history.current.redo.length}
              onClick={() => undo(true)}
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
                onChange={(event) => void seek(Number(event.target.value))}
                disabled={busy}
              />
            </label>
            <StudioAction
              type="button"
              disabled={busy || !project.tracks.some((track) => track.clips.length)}
              onClick={() => void exportAudio(false)}
              icon={Download}
              label="Export mixdown"
            />
            <StudioAction
              type="button"
              disabled={busy || !project.tracks.some((track) => track.clips.length)}
              onClick={() => void exportAudio(true)}
              icon={Layers}
              label="Export track stems"
            />
            {busy && !midiCaptureActive && (
              <button
                type="button"
                onClick={() => {
                  cancelled.current = true;
                  engine.current?.pause();
                }}
              >
                Cancel operation
              </button>
            )}
          </div>
        </details>
        <details className="ae-session-tools">
          <summary>Loop, locators & MIDI recording</summary>
          <div className="ae-fields">
            <label>
              <input
                type="checkbox"
                checked={loopEnabled}
                disabled={busy}
                onChange={(event) => {
                  pause();
                  setLoopEnabled(event.target.checked);
                }}
              />
              Loop region
            </label>
            <label>
              Loop start (s)
              <input
                type="number"
                min="0"
                step={60 / bpm / grid}
                value={loopStart}
                disabled={busy}
                onChange={(event) => {
                  pause();
                  setLoopStart(Number(event.target.value));
                }}
              />
            </label>
            <label>
              Loop end (s)
              <input
                type="number"
                min="0.25"
                step={60 / bpm / grid}
                value={loopEnd}
                disabled={busy}
                onChange={(event) => {
                  pause();
                  setLoopEnd(Number(event.target.value));
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy || !selected || selected.duration < 0.25}
              onClick={() => {
                pause();
                setLoopStart(selected.start);
                setLoopEnd(selected.start + selected.duration);
                setLoopEnabled(true);
              }}
            >
              Loop selected clip
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                edit((next) => ({
                  ...next,
                  locators: [
                    ...(next.locators || []),
                    {
                      id: arrangementId(),
                      name: `Marker ${(next.locators?.length || 0) + 1}`,
                      time: position.current,
                    },
                  ],
                }))
              }
            >
              Add locator at playhead
            </button>
          </div>
          <div className="ae-actions">
            {(project.locators || []).map((marker) => (
              <span key={marker.id} className="ae-locator">
                <input
                  aria-label={`Locator name ${marker.name}`}
                  value={marker.name}
                  disabled={busy}
                  onChange={(event) =>
                    edit((next) => ({
                      ...next,
                      locators: next.locators.map((row) =>
                        row.id === marker.id ? { ...row, name: event.target.value } : row
                      ),
                    }))
                  }
                />
                <button type="button" disabled={busy} onClick={() => void seek(marker.time)}>
                  Go to {marker.name} · {marker.time.toFixed(2)}s
                </button>
                <button
                  type="button"
                  aria-label={`Delete locator ${marker.name}`}
                  disabled={busy}
                  onClick={() =>
                    edit((next) => ({
                      ...next,
                      locators: next.locators.filter((row) => row.id !== marker.id),
                    }))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="ae-actions">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                try {
                  setRecoveries(await recoverSourceCaptures());
                  setEventRecoveries(await journalStore.recover());
                  setMessage(
                    'Stored source chunks are recovery copies. Recovered lanes are muted until you choose to use them.'
                  );
                } catch (error) {
                  setMessage(error.message);
                }
              }}
            >
              Find recoverable source takes
            </button>
            {eventRecoveries.map((take) => (
              <button
                type="button"
                key={take.id}
                disabled={busy}
                onClick={() =>
                  edit((next) => {
                    if (next.captures.some((row) => row.id === take.id)) return next;
                    next.captures.push({ ...take, originalEvents: clone(take.events) });
                    const sources = recoveries.find((row) => row.id === take.sourceCaptureId);
                    for (const track of sources?.tracks || [])
                      if (!next.tracks.some((row) => row.id === track.id))
                        next.tracks.push({ ...clone(track), muted: true, offline: true });
                    return next;
                  })
                }
              >
                Recover events: {take.name} · {take.events.length} · {take.duration.toFixed(1)}s
              </button>
            ))}
            {recoveries.map((take) => (
              <button
                type="button"
                key={take.id}
                disabled={busy}
                onClick={() =>
                  edit((next) => {
                    for (const row of take.tracks) {
                      const existing = next.tracks.find((track) => track.id === row.id);
                      if (existing) {
                        const ids = new Set(existing.clips.map((clip) => clip.id));
                        existing.clips.push(...row.clips.filter((clip) => !ids.has(clip.id)));
                      } else next.tracks.push({ ...clone(row), muted: true, offline: true });
                    }
                    return next;
                  })
                }
              >
                Recover {take.name}
              </button>
            ))}
          </div>
          <MidiInputRecorder
            getOwner={getEngine}
            getInstrumentEngine={getArrangementEngine}
            getPosition={() =>
              engine.current?.playing ? engine.current.position() : position.current
            }
            master={master}
            instrument={selected?.instrument || 'triangle'}
            voiceContext={{
              clip: selected?.kind === 'midi' ? selected : null,
              track: selectedTrack,
              project,
            }}
            disabled={busy || !ready}
            looping={loopEnabled}
            onRecordingChange={(value) => {
              setMidiCaptureActive(value);
              working.current = value;
              setBusy(value);
              onBusy(value);
            }}
            onRecorded={(notes, duration, start, sound) => {
              const source = sound?.clip;
              const track = {
                ...audioTrack('MIDI take'),
                gain: sound?.track?.gain ?? 100,
                pan: sound?.track?.pan ?? 0,
                effects: clone(sound?.track?.effects || []),
                stemRole: sound?.track?.stemRole || 'unseparated',
              };
              track.kind = 'midi';
              track.clips.push({
                ...audioClip(
                  source?.instrument === 'sampler' ? source.assetId : '',
                  'MIDI take',
                  Math.max(0.01, duration),
                  start
                ),
                kind: 'midi',
                timebase: 'beats',
                instrument: source?.instrument || sound?.instrument || 'triangle',
                sampleRoot: source?.sampleRoot || 'C4',
                instrumentSettings: clone(source?.instrumentSettings || {}),
                gain: source?.gain ?? 100,
                notes,
              });
              edit((next) => ({ ...next, tracks: [...next.tracks, track] }));
              setSelection(track.clips[0].id);
            }}
          />
        </details>
        <details className="ae-export-settings" data-mobile-open={mobileTools || busy}>
          <summary>Export range & filename</summary>
          <div className="ae-fields">
            <label>
              Export name
              <input value={exportName} onChange={(event) => setExportName(event.target.value)} />
            </label>
            <label>
              <input
                type="checkbox"
                checked={rangeEnabled}
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
                value={rangeStart}
                onChange={(event) => setRangeStart(Number(event.target.value))}
              />
            </label>
            <label>
              Export end (s)
              <input
                type="number"
                min="0.001"
                step=".01"
                value={rangeEnd}
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
            temporary disk storage. Available disk space and individual source size still apply.
            Files above 4 GiB use RF64 / ZIP64; your destination software must support these
            formats.
          </p>
          {exportFiles.length > 0 && (
            <section aria-label="Export downloads">
              <h3>Export downloads</h3>
              <p>
                Download again if needed. Clear temporary copies only after your download finishes.
                Clearing these files never removes your project or source audio.
              </p>
              {exportFiles.map((entry, index) => (
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
                        setExportFiles((files) => files.filter((item) => item !== entry));
                      } catch (error) {
                        setMessage(`Could not clear temporary export: ${error.message}`);
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
      </div>
      <p role="status">
        {project.tracks.length &&
        message === 'Import audio, add an instrument, or copy deck audio into independent tracks.'
          ? ''
          : message}
        {busy && !midiCaptureActive && !mobileTools && (
          <button
            type="button"
            onClick={() => {
              cancelled.current = true;
              engine.current?.pause();
            }}
          >
            Cancel operation
          </button>
        )}
      </p>
      <input
        ref={midiInput}
        type="file"
        accept=".mid,.midi,audio/midi"
        multiple
        hidden
        aria-label="Import MIDI files"
        onChange={(event) => {
          const files = Array.from(event.target.files || []).map((file) => ({ file }));
          event.target.value = '';
          void addFiles(Promise.resolve(files));
        }}
      />
      <input
        ref={input}
        type="file"
        accept="audio/*,.wav,.mp3,.flac,.aif,.aiff,.m4a"
        multiple
        hidden
        aria-label="Import arrangement audio"
        onChange={(event) => {
          const entries = Array.from(event.target.files || []).map((file) => ({ file }));
          event.target.value = '';
          void addFiles(Promise.resolve(entries), importTarget.current);
        }}
      />
      <input
        ref={relinkInput}
        type="file"
        accept="audio/*,.wav,.mp3,.flac,.aif,.aiff,.m4a"
        hidden
        aria-label="Relink arrangement source"
        onChange={(event) => {
          const file = event.target.files?.[0],
            id = relinkTarget.current;
          event.target.value = '';
          relinkTarget.current = null;
          if (id) void relinkFile(file, id);
        }}
      />
      <div
        className="ae-scroll"
        role="region"
        aria-label="Arrangement timeline"
        style={{ '--ae-playhead-x': `${cursor * zoom}px` }}
        ref={scroll}
        onScroll={(event) =>
          setTimelineView({
            left: event.currentTarget.scrollLeft,
            width: event.currentTarget.clientWidth || 1400,
          })
        }
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!moving.current) void addFiles(droppedLibraryFiles(event.dataTransfer));
        }}
      >
        <div
          className="ae-timeline"
          style={{ width: `calc(${width}px + var(--ae-head-width, 220px))` }}
        >
          <div className="ae-ruler">
            <span>Tracks / bars</span>
            <button
              type="button"
              aria-label="Seek arrangement timeline"
              style={{ width }}
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                void seek(snapped((event.clientX - box.left) / zoom));
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  void seek(cursor + ((event.key === 'ArrowLeft' ? -1 : 1) * 60) / bpm / grid);
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  void seek(0);
                }
              }}
            >
              {rulerMarks(duration, bpm, zoom, timelineView).map((mark) => (
                <i key={mark.time} style={{ left: mark.time * zoom }}>
                  {mark.label}
                </i>
              ))}
            </button>
          </div>
          {project.tracks.map((track) => (
            <div className="ae-track" key={track.id}>
              <div className="ae-track-head">
                <input
                  aria-label={`Track name ${track.name}`}
                  value={track.name}
                  onChange={(event) => changeTrack(track.id, { name: event.target.value })}
                  disabled={busy}
                />
                <small>
                  {track.role === 'reference'
                    ? 'Printed reference · bypasses master processing'
                    : track.kind === 'midi'
                      ? 'Instrument'
                      : 'Audio'}
                </small>
                <button
                  type="button"
                  aria-label={`Open devices for ${track.name}`}
                  onClick={() => {
                    setRackTrack(track.id);
                    showRack();
                  }}
                >
                  Devices · {track.effects?.length || 0} FX
                </button>
                <details className="ae-track-options">
                  <summary>Track options</summary>
                  <label>
                    Master stem group
                    <select
                      aria-label={`Master stem group ${track.name}`}
                      value={track.stemRole || 'unseparated'}
                      disabled={busy}
                      onChange={(event) => changeTrack(track.id, { stemRole: event.target.value })}
                    >
                      {MASTER_STEMS.map(({ id, label }) => (
                        <option value={id} key={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={!!track.offline}
                    onClick={() =>
                      edit((next) => ({
                        ...next,
                        tracks: next.tracks.map((row) =>
                          row.id === track.id ? { ...row, offline: !row.offline } : row
                        ),
                      }))
                    }
                  >
                    {track.offline ? 'Bring track online' : 'Set track offline'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      edit((next) => ({
                        ...next,
                        tracks: next.tracks.flatMap((row) =>
                          row.id === track.id
                            ? [
                                row,
                                {
                                  ...clone(row),
                                  id: arrangementId(),
                                  name: `${row.name} copy`,
                                  clips: row.clips.map((clip) => ({
                                    ...clone(clip),
                                    id: arrangementId(),
                                  })),
                                },
                              ]
                            : [row]
                        ),
                      }))
                    }
                  >
                    Duplicate track
                  </button>
                  <button
                    type="button"
                    disabled={busy || project.tracks[0].id === track.id}
                    onClick={() =>
                      edit((next) => {
                        const index = next.tracks.findIndex((row) => row.id === track.id);
                        [next.tracks[index - 1], next.tracks[index]] = [
                          next.tracks[index],
                          next.tracks[index - 1],
                        ];
                        return next;
                      }, true)
                    }
                  >
                    Move track up
                  </button>
                  <button
                    type="button"
                    disabled={busy || project.tracks.at(-1).id === track.id}
                    onClick={() =>
                      edit((next) => {
                        const index = next.tracks.findIndex((row) => row.id === track.id);
                        [next.tracks[index + 1], next.tracks[index]] = [
                          next.tracks[index],
                          next.tracks[index + 1],
                        ];
                        return next;
                      }, true)
                    }
                  >
                    Move track down
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      edit((next) => ({
                        ...next,
                        tracks: next.tracks.filter((row) => row.id !== track.id),
                      }))
                    }
                  >
                    Delete track
                  </button>
                  <label>
                    Track color
                    <input
                      type="color"
                      value={track.color || '#6b9cbe'}
                      onChange={(event) => changeTrack(track.id, { color: event.target.value })}
                    />
                  </label>
                </details>
                <div>
                  <button
                    type="button"
                    aria-label={`Mute ${track.name}`}
                    aria-pressed={track.muted}
                    onClick={() => changeTrack(track.id, { muted: !track.muted })}
                    disabled={busy}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    aria-label={`Solo ${track.name}`}
                    aria-pressed={track.solo}
                    onClick={() => changeTrack(track.id, { solo: !track.solo })}
                    disabled={busy}
                  >
                    S
                  </button>
                  <label>
                    Gain
                    <input
                      aria-label={`Gain ${track.name}`}
                      type="number"
                      min="0"
                      max="300"
                      value={track.gain}
                      onChange={(event) =>
                        changeTrack(track.id, { gain: bounded(event.target.value, 0, 300) })
                      }
                      disabled={busy}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Pan
                    <input
                      aria-label={`Pan ${track.name}`}
                      type="range"
                      min="-1"
                      max="1"
                      step=".05"
                      value={track.pan}
                      onChange={(event) =>
                        changeTrack(track.id, { pan: Number(event.target.value) })
                      }
                      disabled={busy}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (track.kind === 'midi') {
                        addMidiPattern(track.id);
                        return;
                      }
                      importTarget.current = track.id;
                      input.current?.click();
                    }}
                  >
                    {track.kind === 'midi' ? '+ Pattern' : '+ Audio'}
                  </button>
                </div>
              </div>
              <div
                className="ae-lane"
                data-track-id={track.id}
                onDoubleClick={(event) => {
                  if (busy || track.kind !== 'midi' || event.target.closest('.ae-clip')) return;
                  addMidiPattern(
                    track.id,
                    snapped(
                      (event.clientX - event.currentTarget.getBoundingClientRect().left) / zoom
                    )
                  );
                }}
                style={{
                  width,
                  minHeight: Math.max(96, layouts.get(track.id).count * 58 + 12),
                  '--ae-grid': `${arrangementGridPixels(bpm, grid, zoom)}px`,
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const box = event.currentTarget.getBoundingClientRect(),
                    at = Math.max(0, snapped((event.clientX - box.left) / zoom));
                  if (moving.current) {
                    const id = moving.current;
                    moving.current = null;
                    edit((next) => {
                      let moved;
                      next.tracks.forEach((row) => {
                        moved ||= row.clips.find((clip) => clip.id === id);
                        row.clips = row.clips.filter((clip) => clip.id !== id);
                      });
                      if (moved)
                        next.tracks
                          .find((row) => row.id === track.id)
                          .clips.push({ ...moved, start: at });
                      return next;
                    });
                  } else void addFiles(droppedLibraryFiles(event.dataTransfer), track.id, at);
                }}
              >
                {track.clips
                  .filter(
                    (clip) =>
                      clip.id === dragPreview?.id ||
                      ((clip.start + clip.duration) * zoom >= timelineView.left - 240 &&
                        clip.start * zoom <= timelineView.left + timelineView.width + 240)
                  )
                  .map((clip) => (
                    <button
                      type="button"
                      key={clip.id}
                      draggable={false}
                      onPointerDown={(event) => {
                        if (busy || event.button !== 0) return;
                        const kind = event.target.dataset.clipHandle || 'move';
                        gesture.current = {
                          clip,
                          trackId: track.id,
                          kind,
                          x: event.clientX,
                          y: event.clientY,
                        };
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        const value = gesture.current;
                        if (
                          !value ||
                          value.clip.id !== clip.id ||
                          Math.hypot(event.clientX - value.x, event.clientY - value.y) < 4
                        )
                          return;
                        const delta = (event.clientX - value.x) / zoom;
                        const next =
                          value.kind === 'end'
                            ? resizeClip(clip, Math.max(0.01, snapped(clip.duration + delta)))
                            : value.kind === 'start'
                              ? trimClipStart(clip, snapped(clip.start + delta))
                              : { ...clip, start: Math.max(0, snapped(clip.start + delta)) };
                        setDragPreview(next);
                      }}
                      onPointerCancel={() => {
                        gesture.current = null;
                        setDragPreview(null);
                      }}
                      onPointerUp={(event) => {
                        const value = gesture.current;
                        gesture.current = null;
                        if (!value || !dragPreview) return;
                        suppressClipClick.current = true;
                        const destination =
                          document
                            .elementFromPoint?.(event.clientX, event.clientY)
                            ?.closest('[data-track-id]')?.dataset.trackId || track.id;
                        edit((next) => {
                          if (value.kind === 'move')
                            return moveClips(
                              next,
                              selectionIds.includes(clip.id) ? selectionIds : [clip.id],
                              dragPreview.start - clip.start,
                              track.id,
                              destination
                            );
                          next.tracks.forEach((row) => {
                            row.clips = row.clips.filter((item) => item.id !== clip.id);
                          });
                          next.tracks
                            .find(
                              (row) => row.id === (value.kind === 'move' ? destination : track.id)
                            )
                            .clips.push(dragPreview);
                          return next;
                        });
                        setDragPreview(null);
                      }}
                      onDragStart={(event) => {
                        moving.current = clip.id;
                        event.dataTransfer.setData('text/plain', clip.id);
                      }}
                      onDragEnd={() => {
                        moving.current = null;
                      }}
                      onClick={(event) => {
                        if (suppressClipClick.current) {
                          suppressClipClick.current = false;
                          return;
                        }
                        const nextIds = event.shiftKey
                          ? selectionIds.includes(clip.id)
                            ? selectionIds.filter((id) => id !== clip.id)
                            : [...selectionIds, clip.id]
                          : [clip.id];
                        setChosen(nextIds);
                        setSelection(nextIds.includes(clip.id) ? clip.id : nextIds.at(-1) || null);
                      }}
                      aria-pressed={selectionIds.includes(clip.id)}
                      aria-label={`Select clip ${clip.name}`}
                      className={`ae-clip ${clip.kind}`}
                      style={{
                        left: (dragPreview?.id === clip.id ? dragPreview.start : clip.start) * zoom,
                        width: Math.max(
                          2,
                          (dragPreview?.id === clip.id ? dragPreview.duration : clip.duration) *
                            zoom
                        ),
                        top: 6 + layouts.get(track.id).rows.get(clip.id) * 58,
                        borderColor: track.color,
                      }}
                    >
                      <span
                        className="ae-trim is-start"
                        data-clip-handle="start"
                        title="Drag to trim start"
                      />
                      <span
                        className="ae-trim is-end"
                        data-clip-handle="end"
                        title="Drag to trim end"
                      />
                      <strong>{clip.name}</strong>
                      <small>
                        {clip.kind === 'midi'
                          ? `${clip.notes.length} notes`
                          : `${clip.duration.toFixed(2)}s`}
                      </small>
                      {clip.waveform && (
                        <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
                          <polyline points={waveforms.get(clip.id)} />
                        </svg>
                      )}
                    </button>
                  ))}
                <div className="ae-playhead" style={{ left: 'var(--ae-playhead-x)' }} />
              </div>
            </div>
          ))}
          <div className={`ae-canvas-tail ${!project.tracks.length ? 'is-empty' : ''}`}>
            <div className="ae-tail-head">
              <Plus size={22} aria-hidden="true" />
              <strong>{project.tracks.length ? 'Keep creating' : 'Your tracks go here'}</strong>
              <small>
                Audio or instruments.
                <br />
                One idea at a time.
              </small>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  edit((next) => ({ ...next, tracks: [...next.tracks, audioTrack()] }))
                }
              >
                New audio track
              </button>
              <button type="button" disabled={busy} onClick={addMidi}>
                New instrument track
              </button>
            </div>
            <div
              className="ae-empty-grid"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!moving.current)
                  void addFiles(
                    droppedLibraryFiles(event.dataTransfer),
                    null,
                    Math.max(
                      0,
                      snapped(
                        (event.clientX - event.currentTarget.getBoundingClientRect().left) / zoom
                      )
                    )
                  );
              }}
              style={{
                width,
                '--ae-grid': `${arrangementGridPixels(bpm, grid, zoom)}px`,
                '--ae-bar': `${(240 / bpm) * zoom}px`,
              }}
            >
              {!project.tracks.length && (
                <div className="ae-empty-hint">
                  <Upload size={24} aria-hidden="true" />
                  <strong>Drop audio or MIDI onto the timeline</strong>
                  <span>Or choose Add audio track or Add instrument above.</span>
                </div>
              )}
              <div className="ae-playhead" style={{ left: 'var(--ae-playhead-x)' }} />
            </div>
          </div>
        </div>
      </div>
      <nav className="ae-editor-tabs" aria-label="Lower editor">
        {[
          ['clip', 'Clip'],
          ['devices', 'Devices'],
          ['automation', 'Track automation'],
          ['piano', 'Piano roll'],
          ['sequencer', 'Sequencer'],
          ['performance', 'Performance'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-label={`Show ${label.toLowerCase()} editor`}
            aria-pressed={id === (pianoOpen ? 'piano' : lowerEditor)}
            disabled={id === 'clip' && !selected}
            onClick={() => {
              if (id === 'sequencer') {
                openSequencer();
                return;
              }
              setLowerEditor(id);
              setPianoOpen(id === 'piano');
            }}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={closeEditor}>
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
              setEditorHeight((height) =>
                event.key === 'Home'
                  ? 260
                  : event.key === 'End'
                    ? 750
                    : bounded(height + (event.key === 'ArrowUp' ? 20 : -20), 260, 750)
              );
            }
          }}
          onPointerDown={(event) => {
            editorResize.current = { y: event.clientY, height: editorHeight };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (editorResize.current)
              setEditorHeight(
                bounded(
                  editorResize.current.height + editorResize.current.y - event.clientY,
                  260,
                  750
                )
              );
          }}
          onPointerUp={() => {
            editorResize.current = null;
          }}
          onPointerCancel={() => {
            editorResize.current = null;
          }}
          onLostPointerCapture={() => {
            editorResize.current = null;
          }}
        />
      )}
      <div
        ref={lowerPanel}
        hidden={!pianoOpen && lowerEditor === 'closed'}
        className="ae-lower-editor"
        style={{ '--editor-height': `${editorHeight}px` }}
      >
        <header className="ae-mobile-editor-nav">
          <button type="button" onClick={closeEditor}>
            ← Arrangement
          </button>
          <strong>{pianoOpen ? 'MIDI' : lowerEditor}</strong>
          <button
            type="button"
            disabled={busy || !project.tracks.some((track) => track.clips.length)}
            onClick={toggle}
            aria-label={playing ? 'Pause arrangement in editor' : 'Play arrangement in editor'}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        </header>
        {visible && !pianoOpen && lowerEditor === 'performance' && (
          <section className="sd-performance-editor" aria-label="Performance editor">
            <header>
              <strong>Captured performance</strong>
              {project.captures.length > 0 && (
                <select
                  aria-label="Edit captured take"
                  value={captureSelection || String(project.captures.length - 1)}
                  onChange={(event) => setCaptureSelection(event.target.value)}
                >
                  {project.captures.map((capture, index) => (
                    <option key={capture.id || capture.assetId || index} value={index}>
                      {capture.name}
                    </option>
                  ))}
                </select>
              )}
            </header>
            {project.captures.length === 0 ? (
              <p>
                Capture a performance in Perform. Finish the take, then open it here to edit its
                events and build source lanes.
              </p>
            ) : (
              (() => {
                const captureIndex = Math.min(
                  Number(captureSelection || project.captures.length - 1),
                  project.captures.length - 1
                );
                const capture = project.captures[captureIndex];
                return (
                  <PerformanceEvents
                    key={capture.id || capture.assetId || capture.name}
                    capture={capture}
                    expanded
                    disabled={busy}
                    replaying={activeReplay === (capture.id || capture.assetId)}
                    onReplay={(options) => void replayPerformance(capture, false, options)}
                    onRender={(options) => void replayPerformance(capture, true, options)}
                    onStop={() => void performancePlayer.current?.stop()}
                    onChange={(nextCapture) =>
                      edit((next) => ({
                        ...next,
                        captures: next.captures.map((item, index) =>
                          index === captureIndex ? nextCapture : item
                        ),
                      }))
                    }
                    onBuild={() => {
                      try {
                        const result = reconstructPerformance(current.current, capture);
                        edit(result.project);
                        setMessage(
                          `Source replay added, muted for comparison. Review: ${result.warnings.join('; ')}`
                        );
                      } catch (error) {
                        setMessage(error.message);
                      }
                    }}
                  />
                );
              })()
            )}
          </section>
        )}
        {visible && !pianoOpen && lowerEditor === 'sequencer' && (
          <div>
            <div className="ae-beat-toolbar">
              <label>
                Pattern{' '}
                <select
                  aria-label="Edit beat pattern"
                  value={selected?.instrument === 'drums' ? selected.id : ''}
                  disabled={busy || !ready}
                  onChange={(event) => {
                    setSelection(event.target.value);
                    setChosen([event.target.value]);
                  }}
                >
                  <option value="" disabled>
                    Select a drum pattern
                  </option>
                  {project.tracks.flatMap((track) =>
                    track.clips
                      .filter((clip) => clip.kind === 'midi' && clip.instrument === 'drums')
                      .map((clip) => (
                        <option key={clip.id} value={clip.id}>
                          {track.name} · {clip.name}
                        </option>
                      ))
                  )}
                </select>
              </label>
              <button type="button" disabled={busy || !ready} onClick={() => addMidi('drums')}>
                New beat
              </button>
              <button
                type="button"
                aria-label={
                  playing ? 'Pause arrangement from sequencer' : 'Play arrangement from sequencer'
                }
                disabled={busy || !ready}
                onClick={toggle}
              >
                {playing ? 'Pause arrangement' : 'Play arrangement'}
              </button>
              <button
                type="button"
                disabled={busy || !ready || selected?.instrument !== 'drums'}
                onClick={() => {
                  pause();
                  setLoopStart(selected.start);
                  setLoopEnd(selected.start + selected.duration);
                  setLoopEnabled(true);
                  setPosition(selected.start);
                  setMessage('Beat loop ready. Press Play arrangement to listen.');
                }}
              >
                Set pattern loop
              </button>
              <button type="button" onClick={() => setPianoOpen(true)}>
                Open piano roll
              </button>
            </div>
            {selected?.kind === 'midi' && selected.instrument === 'drums' ? (
              <ArrangementSequencer
                key={selected.id}
                clip={selected}
                bpm={bpm}
                disabled={busy || !ready}
                positionRef={position}
                playing={playing}
                onChange={changeClip}
                onAudition={(note) => {
                  if (!busy)
                    void getEngine()
                      .unlock()
                      .then(() =>
                        getArrangementEngine().audition(
                          note,
                          selected,
                          selectedTrack,
                          project,
                          settings.current
                        )
                      )
                      .catch((error) => setMessage(error.message));
                }}
              />
            ) : (
              <p>Select a drum pattern or choose New beat to start.</p>
            )}
          </div>
        )}
        <div ref={rackPanel} hidden={pianoOpen || lowerEditor !== 'devices'}>
          <ArrangementRack
            revealToken={rackReveal}
            tracks={project.tracks}
            selectedTrackId={rackTrack || selectedTrack?.id}
            busy={busy || !ready}
            onSelectTrack={setRackTrack}
            onInstrument={addMidi}
            onEditInstrument={(id) => {
              setSelection(id);
              setChosen([id]);
              setPianoOpen(true);
            }}
            onEffects={(id, effects) => {
              const row = current.current.tracks.find((track) => track.id === id);
              const automation = Object.fromEntries(
                Object.entries(row?.automation || {}).filter(
                  ([target]) =>
                    !target.startsWith('fx:') ||
                    effects.some((effect) => target.startsWith(`fx:${effect.id}:`))
                )
              );
              changeTrack(id, { effects, automation }, true);
            }}
          />
        </div>
        {!pianoOpen &&
          lowerEditor === 'automation' &&
          (selectedTrack || project.tracks.find((t) => t.id === rackTrack) || project.tracks[0]) &&
          (() => {
            const track =
              project.tracks.find((t) => t.id === rackTrack) || selectedTrack || project.tracks[0];
            return (
              <TrackAutomation
                track={track}
                duration={Math.max(8, arrangementDuration(project))}
                disabled={busy}
                onChange={(automation) => {
                  pause();
                  changeTrack(track.id, { automation });
                }}
              />
            );
          })()}
        {selected && !pianoOpen && lowerEditor === 'clip' && (
          <section className="ae-inspector" aria-label="Clip editor">
            <h4>{selected.name}</h4>
            <details className="ae-comp-controls">
              <summary>Build a take comp</summary>
              <p>
                Choose a region from this track. It replaces that region on the matching comp lane
                and mutes this source track. Original clips stay intact; Undo restores the change.
              </p>
              <div className="ae-fields">
                <label>
                  Comp start (s)
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    disabled={busy}
                    value={compStart ?? selected.start}
                    onChange={(event) => setCompStart(Number(event.target.value))}
                  />
                </label>
                <label>
                  Comp end (s)
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    disabled={busy}
                    value={compEnd ?? selected.start + selected.duration}
                    onChange={(event) => setCompEnd(Number(event.target.value))}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    try {
                      const next = compRegion(
                        current.current,
                        selectedTrack.id,
                        compStart ?? selected.start,
                        compEnd ?? selected.start + selected.duration
                      );
                      edit(next);
                      setMessage(
                        'Region copied to the comp lane. Source track muted; original audio remains untouched.'
                      );
                    } catch (error) {
                      setMessage(error.message);
                    }
                  }}
                >
                  Use region in comp
                </button>
              </div>
            </details>
            {selected.kind === 'audio' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  relinkTarget.current = selected.assetId;
                  relinkInput.current?.click();
                }}
              >
                Relink source audio
              </button>
            )}
            <div className="ae-actions">
              <button
                type="button"
                disabled={
                  busy || cursor <= selected.start || cursor >= selected.start + selected.duration
                }
                onClick={() =>
                  edit((next) => {
                    next.tracks.forEach((track) => {
                      track.clips = track.clips.flatMap((clip) =>
                        clip.id === selection ? splitClip(clip, cursor) : [clip]
                      );
                    });
                    return next;
                  })
                }
              >
                Split at playhead
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  edit((next) => {
                    next.tracks
                      .find((track) => track.id === selectedTrack.id)
                      .clips.push({
                        ...clone(selected),
                        patternId: undefined,
                        id: arrangementId(),
                        start: selected.start + selected.duration,
                      });
                    return next;
                  })
                }
              >
                Duplicate clip
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  edit((next) => {
                    next.tracks.forEach((track) => {
                      track.clips = track.clips.filter((clip) => clip.id !== selection);
                    });
                    return next;
                  })
                }
              >
                Delete clip
              </button>
            </div>
            <div className="ae-fields">
              {[
                ['start', 'Start (s)', 0, 86400],
                ['offset', 'Source offset (s)', 0, 86400],
                ['duration', 'Duration (s)', 0.01, 86400],
                ['gain', 'Clip gain (%)', 0, 300],
                ['fadeIn', 'Fade in (s)', 0, selected.duration],
                ['fadeOut', 'Fade out (s)', 0, selected.duration],
              ]
                .filter(([key]) => selected.kind === 'audio' || key !== 'offset')
                .map(([key, label, min, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      aria-label={label}
                      type="number"
                      min={min}
                      max={max}
                      step=".01"
                      value={selected[key]}
                      disabled={busy}
                      onChange={(event) => {
                        const value = bounded(event.target.value, min, max);
                        changeClip(
                          key === 'duration' ? resizeClip(selected, value) : { [key]: value }
                        );
                      }}
                    />
                  </label>
                ))}
            </div>
            <details className="ae-automation-panel">
              <summary>Automation</summary>
              <div className="ae-automation">
                <h4>Clip automation</h4>
                <AutomationCurve
                  points={selected.automation[target]}
                  duration={selected.duration}
                  parameter={target}
                  disabled={busy}
                  onChange={(points) =>
                    changeClip({ automation: { ...selected.automation, [target]: points } })
                  }
                />
                <label>
                  Parameter
                  <select
                    value={target}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTarget(value);
                      setPointValue(value === 'volume' ? 100 : value === 'pan' ? 0 : 20000);
                    }}
                  >
                    <option value="volume">Volume (%)</option>
                    <option value="pan">Pan (−1 to +1)</option>
                    <option value="filter">Low-pass (Hz)</option>
                  </select>
                </label>
                <label>
                  Time in clip (s)
                  <input
                    type="number"
                    min="0"
                    max={selected.duration}
                    step=".01"
                    value={pointTime}
                    onChange={(event) =>
                      setPointTime(bounded(event.target.value, 0, selected.duration))
                    }
                  />
                </label>
                <label>
                  Value
                  <input
                    type="number"
                    value={pointValue}
                    onChange={(event) => setPointValue(Number(event.target.value))}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const time = bounded(pointTime, 0, selected.duration),
                      value =
                        target === 'pan'
                          ? bounded(pointValue, -1, 1)
                          : target === 'filter'
                            ? bounded(pointValue, 20, 20000)
                            : bounded(pointValue, 0, 300);
                    changeClip({
                      automation: {
                        ...selected.automation,
                        [target]: [
                          ...selected.automation[target].filter(
                            (point) => Math.abs(point.time - time) > 0.001
                          ),
                          { time, value },
                        ].sort((a, b) => a.time - b.time),
                      },
                    });
                  }}
                >
                  Set point
                </button>
                <ul>
                  {selected.automation[target].map((point, index) => (
                    <li key={index}>
                      {point.time.toFixed(2)}s → {point.value}
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Remove automation point ${index + 1}`}
                        onClick={() =>
                          changeClip({
                            automation: {
                              ...selected.automation,
                              [target]: selected.automation[target].filter((_, i) => i !== index),
                            },
                          })
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </section>
        )}
        {visible && pianoOpen && (
          <>
            <section
              id="arrangement-piano-dock"
              className={`ae-piano-dock${pianoExpanded ? ' is-expanded' : ''}`}
              aria-label="Instrument editor"
              style={{ '--editor-height': `${editorHeight}px` }}
            >
              <header className="ae-dock-header">
                <strong>
                  <Piano size={16} aria-hidden="true" /> Instrument editor
                </strong>
                <label>
                  Pattern
                  <select
                    aria-label="Edit instrument pattern"
                    value={selected?.kind === 'midi' ? selected.id : ''}
                    onChange={(event) => {
                      setSelection(event.target.value);
                      setChosen([event.target.value]);
                    }}
                  >
                    <option value="" disabled>
                      Choose a pattern
                    </option>
                    {project.tracks.flatMap((track) =>
                      track.clips
                        .filter((clip) => clip.kind === 'midi')
                        .map((clip) => (
                          <option key={clip.id} value={clip.id}>
                            {track.name} · {clip.name} · {clip.start.toFixed(1)}s
                          </option>
                        ))
                    )}
                  </select>
                </label>
                <button type="button" disabled={busy} onClick={addMidi}>
                  New instrument
                </button>
                <label className="ae-dock-size">
                  Editor height
                  <input
                    aria-label="Instrument editor height"
                    type="range"
                    min="300"
                    max="750"
                    step="10"
                    value={editorHeight}
                    onChange={(event) => setEditorHeight(Number(event.target.value))}
                  />
                </label>
                <button
                  type="button"
                  className="ae-piano-expand"
                  onClick={() => setPianoExpanded(!pianoExpanded)}
                  aria-label={pianoExpanded ? 'Restore piano roll size' : 'Expand piano roll'}
                  aria-pressed={pianoExpanded}
                  title={pianoExpanded ? 'Restore piano roll size' : 'Expand piano roll'}
                >
                  <Maximize2 size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="ae-piano-close"
                  onClick={closeEditor}
                  aria-label="Close instrument editor"
                >
                  Close
                </button>
              </header>
              {selected?.kind === 'midi' ? (
                <>
                  <details className="ae-instrument-settings">
                    <summary>Instrument settings</summary>
                    <div className="ae-instrument-controls">
                      <label>
                        Instrument
                        <select
                          aria-label="Instrument"
                          value={selected.instrument || 'triangle'}
                          disabled={busy}
                          onChange={(event) => {
                            if (event.target.value === 'sampler' && !selected.assetId)
                              sampleInput.current?.click();
                            else changeClip({ instrument: event.target.value });
                          }}
                        >
                          {INSTRUMENTS.map(([id, name]) => (
                            <option value={id} key={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => sampleInput.current?.click()}
                      >
                        Load sample
                      </button>
                      <input
                        ref={sampleInput}
                        type="file"
                        accept="audio/*,.wav,.aif,.aiff,.mp3,.flac,.ogg"
                        hidden
                        aria-label="Instrument sample"
                        onChange={async (event) => {
                          const file = event.target.files?.[0],
                            clipId = selected.id;
                          event.target.value = '';
                          if (!file || working.current) return;
                          if (file.size > 32 * 1024 * 1024) {
                            setMessage('Use an instrument sample smaller than 32 MB.');
                            return;
                          }
                          pause();
                          working.current = true;
                          setBusy(true);
                          onBusy(true);
                          try {
                            const decoded = await getEngine()
                              .getAudioContext()
                              .rawContext.decodeAudioData(await file.arrayBuffer());
                            if (decoded.duration > 60)
                              throw new Error(
                                'Choose a sample under 60 seconds. Import longer recordings as audio tracks.'
                              );
                            const asset = await putAudioAsset(file, { name: file.name });
                            getArrangementEngine().buffers.set(asset.id, decoded);
                            working.current = false;
                            if (mounted.current) {
                              edit((next) =>
                                updatePatternClip(next, clipId, {
                                  instrument: 'sampler',
                                  assetId: asset.id,
                                  sampleRoot: 'C4',
                                })
                              );
                              setMessage(
                                `Sample loaded: ${file.name}. Set its original pitch with Sample root.`
                              );
                            }
                          } catch (error) {
                            if (mounted.current) setMessage(error.message);
                          } finally {
                            working.current = false;
                            if (mounted.current) setBusy(false);
                            onBusy(false);
                          }
                        }}
                      />
                      {selected.instrument === 'sampler' && (
                        <label>
                          Sample root
                          <select
                            aria-label="Sample root"
                            value={selected.sampleRoot || 'C4'}
                            disabled={busy}
                            onChange={(e) => changeClip({ sampleRoot: e.target.value })}
                          >
                            {Array.from(
                              { length: 108 },
                              (_, n) =>
                                `${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12]}${Math.floor(n / 12)}`
                            ).map((pitch) => (
                              <option key={pitch}>{pitch}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        Timebase
                        <select
                          value={selected.timebase || 'seconds'}
                          disabled={busy}
                          onChange={(event) => changeClip({ timebase: event.target.value })}
                        >
                          <option value="seconds">Absolute seconds</option>
                          <option value="beats">Follow project tempo</option>
                        </select>
                      </label>
                      <label>
                        Pattern length (bars)
                        <input
                          type="number"
                          min="0.25"
                          max="256"
                          step="0.25"
                          disabled={busy}
                          value={Number(((selected.duration * bpm) / 240).toFixed(3))}
                          title="Changing length makes this pattern independent of its repetitions"
                          onChange={(event) =>
                            changeClip(
                              resizeClip(
                                selected,
                                (bounded(event.target.value, 0.25, 256, 1) * 240) / bpm
                              )
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const next = repeatLinkedPattern(current.current, selected.id);
                          const repeated = next.tracks
                            .find((track) => track.id === selectedTrack.id)
                            .clips.at(-1);
                          edit(next);
                          setSelection(repeated.id);
                          setChosen([repeated.id]);
                        }}
                      >
                        Repeat linked pattern
                      </button>
                      <details className="ae-voice-options">
                        <summary>Sound controls</summary>
                        <div>
                          {[
                            [
                              'attack',
                              'Attack (s)',
                              0.001,
                              4,
                              0.001,
                              selected.instrument === 'pad' ? 0.16 : 0.005,
                            ],
                            ['release', 'Release (s)', 0.005, 2, 0.005, 0.04],
                            [
                              'cutoff',
                              'Tone cutoff (Hz)',
                              40,
                              20000,
                              10,
                              selected.instrument === 'bass'
                                ? 1800
                                : ['synth', 'pad'].includes(selected.instrument)
                                  ? 4000
                                  : 20000,
                            ],
                          ].map(([key, label, min, max, step, fallback]) => (
                            <label key={key}>
                              {label}
                              <input
                                type="number"
                                min={min}
                                max={max}
                                step={step}
                                value={selected.instrumentSettings?.[key] ?? fallback}
                                disabled={busy}
                                onChange={(e) =>
                                  changeClip({
                                    instrumentSettings: {
                                      ...selected.instrumentSettings,
                                      [key]: bounded(e.target.value, min, max, fallback),
                                    },
                                  })
                                }
                              />
                            </label>
                          ))}
                          <small>Release stays within the written note length.</small>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeClip({ instrumentSettings: {} })}
                          >
                            Reset sound
                          </button>
                        </div>
                      </details>
                      {selected.patternId && (
                        <>
                          <span>
                            {
                              project.tracks
                                .flatMap((track) => track.clips)
                                .filter((clip) => clip.patternId === selected.patternId).length
                            }{' '}
                            linked · notes & instrument shared
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeClip({ patternId: undefined })}
                          >
                            Make independent
                          </button>
                        </>
                      )}
                      {selected.instrument === 'drums' && (
                        <span>
                          C: kick · D: snare · F♯: closed hat · A♯: open hat · others: toms
                        </span>
                      )}
                    </div>
                  </details>
                  <ArrangementNotes
                    compact
                    key={selected.id}
                    clip={selected}
                    bpm={bpm}
                    disabled={busy}
                    ghosts={ghosts}
                    playhead={cursor - selected.start}
                    positionRef={position}
                    playing={playing}
                    onChange={(notes) => changeClip({ notes })}
                    onAudition={(note) => {
                      if (!busy)
                        void getEngine()
                          .unlock()
                          .then(() =>
                            getArrangementEngine().audition(
                              note,
                              selected,
                              selectedTrack,
                              project,
                              settings.current
                            )
                          )
                          .catch((error) => setMessage(error.message));
                    }}
                  />
                </>
              ) : (
                <div className="ae-dock-empty">
                  <h3>Your instrument workspace</h3>
                  <p>Select an instrument pattern or add one to start writing notes.</p>
                  <button type="button" disabled={busy} onClick={addMidi}>
                    Add instrument pattern
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {recordings.length > 0 && (
        <details className="ae-captures">
          <summary>Recorded takes · add to arrangement</summary>
          <div className="ae-actions">
            {recordings.map((recording) => (
              <button
                type="button"
                disabled={busy || !ready}
                key={recording.id}
                onClick={() => void addTake(recording)}
              >
                Add take: {recording.name}
              </button>
            ))}
          </div>
        </details>
      )}
      <footer>
        Arrange preview 2026.09.21.3 · Audio-clock playback · Live clip editing is under validation
        · Track stems are pre-master, not AI separation · Keep a portable project backup.
      </footer>
    </section>
  );
}
export default forwardRef(ArrangementEditor);
