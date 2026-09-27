import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  clearStudioSession,
  getAudioAsset,
  importAudioAssets,
  loadStudioSession,
  saveStudioSession,
  validateStudioProject,
} from '../../utils/audioProjectStore';
import { migrateArrangement } from '../../utils/arrangementModel';
import { clearExportFile } from '../../utils/arrangementStreamExport';
import { deferredSessionSave } from '../../utils/deferredSessionSave';
import { readProjectArchive, writeProjectArchive } from '../../utils/projectArchive';
import { persistentSession } from '../../utils/sessionPersistence';
import { trackSiteEvent } from '../../utils/siteMeasurement';
import { downloadBlob } from '../downloads';
import { useLatest } from '../hooks/useLatest';
import { SEND_BUSES } from '../mixer/mixerModel';
import { normalizeDeck, normalizeDecks } from './sessionModel';
import {
  consumeLearnTransfer,
  isProjectManifest,
  projectAssetIds,
  projectManifest,
  relinkManifestAssets,
  snapshotFromManifest,
  snapshotFromSaved,
} from './sessionSnapshot';
import { createSessionActions, initialSessionState, sessionReducer } from './sessionState';

const AUTOSAVE_FAILED =
  'Autosave failed: local storage is full or unavailable. Use Save project to download a backup before closing.';

/**
 * Session state (one reducer) and its lifecycle: restore on mount, autosave,
 * portable export/import and new session. Restore, import and new session all
 * go through applySession, so a replaced session cannot leak any field.
 */
export function useStudioSession({
  engine,
  arrangerRef,
  transport,
  activity,
  setNotice,
  setMicrophoneActive,
}) {
  const { getEngine, objectUrlsRef, releaseAudio } = engine;
  const [state, dispatch] = useReducer(sessionReducer, undefined, initialSessionState);
  const latest = useLatest(state);
  const actions = useMemo(() => createSessionActions(dispatch), []);
  // Rendered (the arrangement editor's `ready`) and mirrored for synchronous guards.
  const [projectPending, setProjectPendingState] = useState(false);
  const setProjectPending = useCallback(
    (value) => {
      activity.projectPending = value;
      setProjectPendingState(value);
    },
    [activity]
  );
  const [persistence] = useState(() =>
    persistentSession({
      loadLegacy: loadStudioSession,
      saveLegacy: saveStudioSession,
      clearLegacy: clearStudioSession,
    })
  );
  const [saver] = useState(() =>
    deferredSessionSave(
      (value) => persistence.save(value),
      (error) =>
        setNotice(
          error instanceof Error && error.message.startsWith('Another Studio tab')
            ? error.message
            : AUTOSAVE_FAILED
        )
    )
  );
  // Incremented whenever the current session is torn down; an in-flight
  // restore that sees a newer epoch must not apply over the replacement.
  const epoch = useRef(0);

  const hydrateAudio = useCallback(
    async (nextDecks, nextPads, isCancelled, tempo) => {
      const audio = getEngine();
      const hydrated = nextDecks.map((deck, index) => normalizeDeck(deck, index));
      for (const deck of hydrated) {
        audio.ensureDeck(deck.id, deck.side);
        audio.setDeckGain(deck.id, deck.gain);
        audio.setDeckFader(deck.id, deck.fader);
        audio.setDeckSide(deck.id, deck.cfSide);
        audio.setDeckEq(deck.id, deck.eq);
        audio.setDeckFilter(deck.id, deck.filter);
        audio.setDeckFx(deck.id, deck.fx);
        audio.setDeckPitch(deck.id, deck.pitch);
        audio.setDeckKeyLock(deck.id, deck.keyLock);
        for (const bus of SEND_BUSES) audio.setDeckSend?.(deck.id, bus, deck.sends[bus]);
        audio.setDeckInserts?.(deck.id, deck.inserts);
        for (const [laneId, lane] of Object.entries(deck.lanes)) {
          if (!lane.assetId) continue;
          try {
            const asset = await getAudioAsset(lane.assetId);
            if (!asset || isCancelled()) {
              lane.status = 'error';
              continue;
            }
            lane.duration = await audio.loadLane(deck.id, deck.side, laneId, asset.blob);
            lane.status = 'ready';
            lane.name = lane.name || asset.name;
            audio.setLaneState(deck.id, laneId, lane);
            if (deck.stemFx[laneId]) audio.setLaneFx(deck.id, laneId, deck.stemFx[laneId]);
          } catch {
            lane.status = 'error';
          }
        }
        audio.setPlaybackRate(deck.id, deck.synced ? tempo / Math.max(1, deck.bpm) : 1);
        await audio.setLoopRegion(deck.id, deck.looping, deck.loopStart, deck.loopEnd);
      }
      for (const [index, pad] of nextPads.entries()) {
        if (!pad.assetId) continue;
        try {
          const asset = await getAudioAsset(pad.assetId);
          if (!asset || isCancelled()) continue;
          const url = URL.createObjectURL(asset.blob);
          objectUrlsRef.current.set(`pad:${index}`, url);
          await audio.loadPad(index, url, pad.gain);
        } catch {
          // The built-in synth remains active when a stored sample is unavailable.
        }
      }
      return hydrated;
    },
    [getEngine, objectUrlsRef]
  );

  /** The only way a whole session enters the page: engine, audio, then state. */
  const applySession = useCallback(
    async (snapshot, isCancelled = () => false) => {
      const { arrangerSource, ...session } = snapshot;
      const audio = getEngine();
      audio.setCrossfaderCurve(session.crossfaderCurve);
      audio.setCrossfader(
        session.crossfaderReverse ? 100 - session.crossfader : session.crossfader
      );
      audio.setMasterLevel(session.masterLevel);
      audio.setMasterProcessing(session.masterProcessing);
      audio.setLimiter(session.limiter);
      audio.setMasterAssist(session.aiMaster, session.aiMasterMode);
      for (const bus of SEND_BUSES) audio.setReturn?.(bus, session.mixer.returns[bus]);
      const decks = await hydrateAudio(session.decks, session.pads, isCancelled, session.masterBpm);
      if (isCancelled()) return;
      actions.apply({
        ...session,
        decks,
        arranger: migrateArrangement({ ...arrangerSource, decks }),
      });
    },
    [actions, getEngine, hydrateAudio]
  );

  const releaseSession = useCallback(() => {
    epoch.current += 1;
    window.clearInterval(activity.automix);
    arrangerRef.current?.reset();
    releaseAudio();
    transport.reset();
    setMicrophoneActive(false);
  }, [activity, arrangerRef, releaseAudio, setMicrophoneActive, transport]);

  useEffect(() => {
    let cancelled = false;
    const startedAt = epoch.current;
    const stale = () => cancelled || epoch.current !== startedAt;
    const restore = async () => {
      const saved = await persistence.load();
      if (saved) validateStudioProject({ ...saved, decks: saved.decks || [] });
      if (stale()) return;
      const { decks, transfer } = consumeLearnTransfer(normalizeDecks(saved?.decks));
      await applySession(snapshotFromSaved(saved, { decks, transfer }), stale);
    };
    void restore().catch((error) => {
      if (!stale())
        setNotice(
          `Project restore failed: ${error instanceof Error ? error.message : 'audio unavailable'}. Reload to retry; your saved session has not been overwritten.`
        );
    });
    return () => {
      cancelled = true;
    };
  }, [applySession, persistence, setNotice]);

  useEffect(() => {
    const flush = () => saver.flush();
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [saver]);

  // Autosave only persisted fields; focus, sync master and XY pad moves are not saved.
  const {
    restored,
    sessionName,
    decks,
    pads,
    recordings,
    crossfader,
    crossfaderCurve,
    crossfaderReverse,
    masterLevel,
    masterProcessing,
    masterBpm,
    projectKey,
    limiter,
    aiMaster,
    aiMasterMode,
    transfer,
    pianoNotes,
    arranger,
    mixer,
  } = state;
  useEffect(() => {
    if (!restored) return;
    saver.schedule({
      uiSchemaVersion: 2,
      sessionName,
      decks,
      pads,
      recordings,
      crossfader,
      crossfaderCurve,
      crossfaderReverse,
      masterLevel,
      masterProcessing,
      masterBpm,
      projectKey,
      limiter,
      aiMaster,
      aiMasterMode,
      transfer,
      pianoNotes,
      arranger,
      mixer,
    });
  }, [
    aiMaster,
    aiMasterMode,
    arranger,
    crossfader,
    crossfaderCurve,
    crossfaderReverse,
    decks,
    limiter,
    masterBpm,
    masterLevel,
    masterProcessing,
    mixer,
    pads,
    pianoNotes,
    projectKey,
    recordings,
    restored,
    saver,
    sessionName,
    transfer,
  ]);

  const exportSession = useCallback(async () => {
    if (
      activity.projectPending ||
      activity.loads.size ||
      activity.capturePending ||
      activity.captureActive
    ) {
      setNotice('Finish importing and stop the recording before saving a portable project.');
      return;
    }
    try {
      setProjectPending(true);
      setNotice('Packing the project and its audio for transfer...');
      const session = latest.current;
      const assetIds = projectAssetIds(session);
      const blob = await writeProjectArchive(projectManifest(session), assetIds, setNotice);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${session.sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sattari-session'}.sattari`;
      anchor.click();
      trackSiteEvent('studio_exported');
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        void clearExportFile(blob).catch(() => {});
      }, 60000);
      setNotice(
        `Portable project saved with ${new Set(assetIds.filter(Boolean)).size} audio assets.`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Project could not be saved.');
    } finally {
      setProjectPending(false);
    }
  }, [activity, latest, setNotice, setProjectPending]);

  const importSession = useCallback(
    async (file) => {
      if (!file) return;
      if (activity.projectPending) {
        setNotice('Wait for the project to finish opening.');
        return;
      }
      if (activity.captureActive || activity.capturePending || activity.loads.size) {
        setNotice('Finish loading and stop the recording before opening another project.');
        return;
      }
      setProjectPending(true);
      try {
        const manifest = await readProjectArchive(file);
        if (!isProjectManifest(manifest)) throw new Error('Not a Sattari Studio project.');
        validateStudioProject(manifest);
        if (
          !window.confirm(
            'Open this project and replace the current session? Download a backup with Save project first if needed.'
          )
        )
          return;
        setNotice('Opening project and restoring audio…');
        relinkManifestAssets(manifest, await importAudioAssets(manifest.assets || []));
        releaseSession();
        await applySession(snapshotFromManifest(manifest));
        setNotice(
          manifest.assets?.length
            ? `${file.name} imported with ${manifest.assets.length} embedded audio assets.`
            : `${file.name} imported. Reconnect audio files that are not stored on this device.`
        );
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Project could not be imported.');
      } finally {
        setProjectPending(false);
      }
    },
    [activity, applySession, releaseSession, setNotice, setProjectPending]
  );

  const newSession = useCallback(async () => {
    if (activity.projectPending) {
      setNotice('Wait for the project to finish opening.');
      return;
    }
    if (activity.captureActive || activity.capturePending || activity.loads.size) {
      setNotice('Finish loading and stop the recording before starting a new session.');
      return;
    }
    if (!window.confirm('Start a new session? Local audio assets will remain available.')) return;
    setProjectPending(true);
    try {
      try {
        await saver.flush();
        await persistence.clear();
      } catch (error) {
        setNotice(error.message);
        return;
      }
      releaseSession();
      await applySession(snapshotFromSaved(null));
      setNotice('New Sattari Stemdeck session ready.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'A new session could not be started.');
    } finally {
      setProjectPending(false);
    }
  }, [activity, applySession, persistence, releaseSession, saver, setNotice, setProjectPending]);

  const downloadRecording = useCallback(
    async (recording) => {
      try {
        const asset = await getAudioAsset(recording.id);
        if (!asset?.blob)
          throw new Error(
            'Recording audio is missing from local storage. Restore it from a backup.'
          );
        downloadBlob(asset.blob, recording.name, 0);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Recording download failed.');
      }
    },
    [setNotice]
  );

  return {
    state,
    latest,
    actions,
    ready: state.restored && !projectPending,
    exportSession,
    importSession,
    newSession,
    downloadRecording,
  };
}
