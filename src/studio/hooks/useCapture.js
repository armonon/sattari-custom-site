import { useCallback, useEffect, useRef, useState } from 'react';
import { createWaveformPeaks } from '../../utils/audioAnalysis';
import { putAudioAsset } from '../../utils/audioProjectStore';
import { audioClip, audioTrack } from '../../utils/arrangementModel';
import { downloadBlob } from '../downloads';
import { useLatest } from './useLatest';

/**
 * Adds a finished take to the arrangement: its source lanes and event
 * capture, plus the decoded master reference when the browser could decode it.
 */
export function withCapturedTake(project, { blob, sourceTracks, capture, reference }) {
  const captured = {
    ...project,
    tracks: [
      ...project.tracks,
      ...sourceTracks.map((row) =>
        !blob &&
        row.role === 'reference' &&
        !project.tracks.some((track) => !track.muted && !track.offline && track.clips.length)
          ? { ...row, muted: false, offline: false }
          : row
      ),
    ],
    captures: [...project.captures, capture],
  };
  if (!reference) return captured;
  return {
    ...captured,
    tracks: [
      ...captured.tracks.map((row) => (row.role === 'reference' ? { ...row, muted: true } : row)),
      {
        ...reference.track,
        muted: captured.tracks.some(
          (row) => row.role !== 'reference' && !row.muted && row.clips.length
        ),
      },
    ],
    captures: captured.captures.map((item) =>
      item.assetId === capture.assetId ? { ...item, duration: reference.duration } : item
    ),
  };
}

/** Live-set recording: start/stop, take persistence and recovery of unsaved takes. */
export function useCapture({
  engine,
  session,
  arranger,
  arrangerRef,
  activity,
  activeView,
  setNotice,
}) {
  const { getEngine, engineRef } = engine;
  const { setRecordings } = session.actions;
  const { applyEdit } = arranger;
  const [captureSeparateSources, setCaptureSeparateSources] = useState(true);
  const [longSession, setLongSession] = useState(false);
  const [recordingHealth, setRecordingHealth] = useState(null);
  const [captureActive, setCaptureActiveState] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  // A take whose local save has not completed; it blocks the next recording
  // and page close until the user confirms a downloaded copy.
  const [unsavedTake, setUnsavedTakeState] = useState(null);
  const unsaved = useRef(null);
  const timelineStart = useRef(0);
  const context = useLatest({
    session: session.state,
    activeView,
    captureSeparateSources,
    longSession,
  });

  const setCaptureActive = useCallback(
    (value) => {
      activity.captureActive = value;
      setCaptureActiveState(value);
    },
    [activity]
  );
  const setUnsavedTake = useCallback((take) => {
    unsaved.current = take;
    setUnsavedTakeState(take);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const health = engineRef.current?.getRecordingHealth?.();
      if (engineRef.current?.performanceStartedAt != null) setRecordingHealth(health);
    }, 1000);
    return () => clearInterval(timer);
  }, [engineRef]);

  useEffect(() => {
    const protectCapture = (event) => {
      if (!captureActive && !activity.capturePending && !unsaved.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectCapture);
    return () => window.removeEventListener('beforeunload', protectCapture);
  }, [activity, captureActive]);

  const startCapture = async () => {
    const { session: current, activeView: view, ...options } = context.current;
    const audio = getEngine();
    timelineStart.current = view === 'arranger' ? arrangerRef.current?.getPosition?.() || 0 : 0;
    await audio.startRecording({
      sources: options.captureSeparateSources,
      longSession: options.longSession,
      timelineStart: timelineStart.current,
    });
    getEngine().capturePerformanceEvent?.('initialState', [
      {
        decks: current.decks.map((deck) => ({
          ...deck,
          position: getEngine().getDeckPosition?.(deck.id) || 0,
          playbackRate: getEngine().decks?.get(deck.id)?.playbackRate || 1,
          gain: getEngine().decks?.get(deck.id)?.gain ?? deck.gain,
          fader: getEngine().decks?.get(deck.id)?.fader ?? deck.fader,
          lanes: Object.fromEntries(
            Object.entries(deck.lanes).map(([id, lane]) => {
              const actual = getEngine().decks?.get(deck.id)?.lanes.get(id);
              return [
                id,
                {
                  ...lane,
                  ...(actual
                    ? {
                        level: actual.level,
                        muted: actual.muted,
                        solo: actual.solo,
                        filter: actual.filter,
                        send: actual.send,
                        pitch: actual.pitch,
                      }
                    : {}),
                },
              ];
            })
          ),
          playing: !!getEngine().decks?.get(deck.id)?.playing,
        })),
        dspVersion: 2,
        clockVersion: 1,
        sampleRate: engineRef.current.getAudioContext().rawContext.sampleRate,
        inputCaptureVersion: 1,
        inputState: engineRef.current.getInputState(),
        transportVersion: 2,
        pads: current.pads,
        masterBpm: current.masterBpm,
        masterLevel: current.masterLevel,
        masterProcessing: current.masterProcessing,
        crossfader: current.crossfader,
        crossfaderCurve: current.crossfaderCurve,
        limiter: current.limiter,
        aiMaster: current.aiMaster,
        aiMasterMode: current.aiMasterMode,
        returns: current.mixer.returns,
      },
    ]);
    setCaptureActive(true);
    setRecordingHealth(null);
    setNotice(
      getEngine().capturedSources?.()?.error ||
        (options.captureSeparateSources
          ? 'Recording master safety mix and separate connected sources. Finish connecting sources before starting a take.'
          : 'Master recording started.')
    );
  };

  const finishCapture = async () => {
    const { sessionName, recordings } = context.current.session;
    const blob = await getEngine().stopRecording();
    setCaptureActive(false);
    const sourceCapture = getEngine().capturedSources?.();
    if (!blob && !sourceCapture?.tracks?.length) return;
    const extension = !blob
      ? 'wav chunks'
      : blob.type.includes('mp4')
        ? 'm4a'
        : blob.type.includes('ogg')
          ? 'ogg'
          : 'webm';
    const name = `${sessionName} take ${recordings.length + 1}.${extension}`;
    if (blob) setUnsavedTake({ blob, name });
    const asset = blob ? await putAudioAsset(blob, { name, type: blob.type }) : { id: '' };
    setUnsavedTake(null);
    if (blob)
      setRecordings((current) => [
        ...current,
        { id: asset.id, name, createdAt: asset.createdAt, size: asset.size },
      ]);
    // Event history and durable source chunks must survive even when this
    // browser cannot decode the master recorder's compressed container.
    const events = structuredClone(getEngine().capturedPerformance?.() || []);
    const captureDuration =
      getEngine().lastRecordingDuration ||
      events.reduce((end, event) => Math.max(end, event.time), 0);
    const journal = getEngine().performanceJournal;
    await journal?.attach({ assetId: asset.id, name, duration: captureDuration }).catch(() => {});
    const sourceTracks = (sourceCapture?.tracks || []).map((row) => ({
      ...row,
      name: `${name} · ${row.name}`,
      muted: true,
      offline: true,
    }));
    const capture = {
      version: 3,
      id: journal?.take?.id,
      sourceCaptureId: sourceCapture?.id,
      assetId: asset.id,
      name,
      duration: captureDuration,
      timelineStart: timelineStart.current,
      events,
      originalEvents: structuredClone(events),
    };
    if (!blob) {
      applyEdit((project) => withCapturedTake(project, { blob, sourceTracks, capture }));
      setNotice(
        `Performance captured · ${Math.round(captureDuration)}s · ${sourceTracks.length} lanes · ${events.filter((event) => event.type !== 'initialState').length} recorded actions. Open performance in Arrange; master safety audio is preserved. ${sourceCapture?.error || getEngine().recordingFault || ''}`
      );
      return;
    }
    let reference = null;
    try {
      const buffer = await getEngine()
        .getAudioContext()
        .rawContext.decodeAudioData(await blob.arrayBuffer());
      const track = audioTrack(name);
      track.role = 'reference';
      track.clips.push({
        ...audioClip(asset.id, name, buffer.duration, timelineStart.current),
        waveform: createWaveformPeaks(buffer.getChannelData(0), 2048),
      });
      reference = { track, duration: buffer.duration };
    } catch {
      // The take and its events are still added below; only the editable lane is missing.
    }
    // One undoable step for the whole take, whether or not it decoded.
    applyEdit((project) => withCapturedTake(project, { blob, sourceTracks, capture, reference }));
    setNotice(
      !reference
        ? `${name} saved. This browser could not decode the take for editing; download it from Recordings.`
        : sourceTracks.length
          ? `${name} saved with ${sourceTracks.length} aligned source lanes (offline and muted) and a master safety reference. Enable chosen lanes in Track options, then unmute or comp them; avoid doubling the reference. Deck FX are printed. ${sourceCapture.error || ''}`
          : `${name} saved as an editable printed reference. ${sourceCapture?.error || 'This lane bypasses repeated master processing.'}`
    );
  };

  const toggleCapture = async () => {
    if (activity.projectPending) {
      setNotice('Wait for the project to finish opening.');
      return;
    }
    if (unsaved.current) {
      setNotice('Download and confirm your unsaved take before recording again.');
      return;
    }
    if (activity.capturePending) return;
    setCaptureBusy(true);
    activity.capturePending = true;
    try {
      if (!activity.captureActive) await startCapture();
      else await finishCapture();
    } catch (error) {
      setCaptureActive(false);
      if (unsaved.current) {
        const { blob, name } = unsaved.current;
        downloadBlob(blob, name, 60000);
        setNotice(
          'Local storage could not save your take. An emergency download was requested; confirm it completed before closing this page.'
        );
      } else setNotice(error instanceof Error ? error.message : 'Recording is unavailable.');
    } finally {
      activity.capturePending = false;
      setCaptureBusy(false);
    }
  };

  const downloadUnsavedTake = () => {
    const { blob, name } = unsaved.current;
    downloadBlob(blob, name, 60000);
  };

  const confirmUnsavedTake = () => {
    if (
      !window.confirm(
        'Have you verified that the downloaded take is saved? This releases the in-memory recovery copy.'
      )
    )
      return;
    setUnsavedTake(null);
    setNotice('Recording backup confirmed. You can record another take.');
  };

  return {
    captureActive,
    captureBusy,
    recordingHealth,
    unsavedTake,
    captureSeparateSources,
    setCaptureSeparateSources,
    longSession,
    setLongSession,
    toggleCapture,
    downloadUnsavedTake,
    confirmUnsavedTake,
  };
}
