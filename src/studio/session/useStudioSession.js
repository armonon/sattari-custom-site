import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  clearStudioSession,
  getAudioAsset,
  importAudioAssets,
  loadStudioSession,
  saveStudioSession,
  validateStudioProject,
} from '../../utils/audioProjectStore';
import { migrateArrangement, repairArrangement } from '../../utils/arrangementModel';
import { clearExportFile } from '../../utils/arrangementStreamExport';
import { deferredSessionSave } from '../../utils/deferredSessionSave';
import { readProjectArchive, writeProjectArchive } from '../../utils/projectArchive';
import { persistentSession } from '../../utils/sessionPersistence';
import { trackSiteEvent } from '../../utils/siteMeasurement';
import { downloadBlob } from '../downloads';
import { useLatest } from '../hooks/useLatest';
import { SEND_BUSES } from '../mixer/mixerModel';
import {
  formatBytes,
  holdStudioTabLock,
  otherStudioTabsOpen,
  planStorageCleanup,
  runStorageCleanup,
} from './storageCleanup';
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

/**
 * Repairs `project.arranger` in place and returns how many damaged parts were
 * newly set aside, so one bad clip or take cannot keep a project from opening.
 */
function repairSavedArrangement(project) {
  const before = project.arranger?.setAside?.length || 0;
  project.arranger = repairArrangement(project.arranger);
  return (project.arranger.setAside?.length || 0) - before;
}

const setAsideNotice = (count, reason = 'so the project could open') =>
  `${count} damaged arrangement ${count === 1 ? 'part was' : 'parts were'} set aside ${reason}. They are kept with this session: open Tools, then Files.`;

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
  // The last portable backup stays downloadable until it is replaced or
  // cleared: a slow or blocked multi-GB download can be started again.
  const [backup, setBackup] = useState(null);
  // How many set-aside arrangement parts the user has already been told about.
  const setAsideSeen = useRef(0);
  const backupRef = useRef(null);
  const replaceBackup = useCallback((next) => {
    const previous = backupRef.current;
    backupRef.current = next;
    setBackup(next);
    if (previous && previous.file !== next?.file)
      void clearExportFile(previous.file).catch(() => {});
  }, []);

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
      const arranger = migrateArrangement({ ...arrangerSource, decks });
      // Restore and import report their own set-aside parts.
      setAsideSeen.current = arranger.setAside?.length || 0;
      actions.apply({ ...session, decks, arranger });
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
      const setAside = saved?.arranger ? repairSavedArrangement(saved) : 0;
      if (saved) validateStudioProject({ ...saved, decks: saved.decks || [] });
      if (stale()) return;
      const { decks, transfer } = consumeLearnTransfer(normalizeDecks(saved?.decks));
      await applySession(snapshotFromSaved(saved, { decks, transfer }), stale);
      if (setAside && !stale()) setNotice(setAsideNotice(setAside));
    };
    // Loads, imports and recording wait until the restored session is in
    // place; otherwise the restore would overwrite what they just loaded.
    setProjectPending(true);
    void restore()
      .catch((error) => {
        if (!stale())
          setNotice(
            `Project restore failed: ${error instanceof Error ? error.message : 'audio unavailable'}. Reload to retry; your saved session has not been overwritten.`
          );
      })
      .finally(() => {
        if (!cancelled) setProjectPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applySession, persistence, setNotice, setProjectPending]);

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
  const setAsideCount = arranger.setAside?.length || 0;
  useEffect(() => {
    if (setAsideCount > setAsideSeen.current)
      setNotice(setAsideNotice(setAsideCount - setAsideSeen.current, 'instead of being saved'));
    setAsideSeen.current = setAsideCount;
  }, [setAsideCount, setNotice]);
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
      const name = `${session.sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sattari-session'}.sattari`;
      replaceBackup({ file: blob, name });
      downloadBlob(blob, name, 60000);
      trackSiteEvent('studio_exported');
      const count = new Set(assetIds.filter(Boolean)).size;
      setNotice(
        `Project backup ready (${count} audio ${count === 1 ? 'file' : 'files'}, ${formatBytes(blob.size)}). If the download does not finish, use Download again in Tools › Files.`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Project could not be saved.');
    } finally {
      setProjectPending(false);
    }
  }, [activity, latest, replaceBackup, setNotice, setProjectPending]);

  // Damaged arrangement parts set aside by repairArrangement.
  const downloadSetAside = useCallback(() => {
    const { arranger, sessionName } = latest.current;
    if (!arranger.setAside?.length) return;
    const report = {
      schema: 'SattariStudio.setAside.v1',
      sessionName,
      exportedAt: new Date().toISOString(),
      parts: arranger.setAside,
    };
    const slug = sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sattari-session';
    downloadBlob(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
      `${slug}-damaged-parts.json`,
      60000
    );
  }, [latest]);
  const discardSetAside = useCallback(() => {
    const count = latest.current.arranger.setAside?.length || 0;
    if (
      !count ||
      !window.confirm(
        `Discard ${count} damaged arrangement ${count === 1 ? 'part' : 'parts'}? Download them first if you might need them.`
      )
    )
      return;
    const without = (project) => {
      const next = { ...project };
      delete next.setAside;
      return next;
    };
    if (!arrangerRef.current?.applyEdit?.(without)) actions.setArranger(without);
  }, [actions, arrangerRef, latest]);

  const downloadBackup = useCallback(() => {
    const current = backupRef.current;
    if (current) downloadBlob(current.file, current.name, 60000);
  }, []);
  const clearBackup = useCallback(() => replaceBackup(null), [replaceBackup]);

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
        const setAside = manifest.arranger ? repairSavedArrangement(manifest) : 0;
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
          `${
            manifest.assets?.length
              ? `${file.name} imported with ${manifest.assets.length} embedded audio assets.`
              : `${file.name} imported. Reconnect audio files that are not stored on this device.`
          }${setAside ? ` ${setAsideNotice(setAside)}` : ''}`
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

  /**
   * Frees browser storage nothing uses: stored audio no project, pending
   * transfer or recoverable take references, and recovery copies of takes the
   * project already contains. The session is saved first, so a take is never
   * left with only its recovery copy, and nothing is removed without asking.
   */
  useEffect(() => holdStudioTabLock(), []);

  const cleanUpStorage = useCallback(async () => {
    if (
      activity.captureActive ||
      activity.capturePending ||
      activity.projectPending ||
      activity.loads.size
    ) {
      setNotice('Finish loading and stop the recording before cleaning up storage.');
      return false;
    }
    try {
      if (await otherStudioTabsOpen()) {
        setNotice(
          'Close other Studio tabs before cleaning up storage: their audio is not visible here.'
        );
        return false;
      }
      await saver.flush();
      const plan = await planStorageCleanup(latest.current, {
        keepFiles: [backupRef.current?.file?.name],
      });
      if (
        !plan.unused.length &&
        !plan.exports.length &&
        !plan.takeIds.length &&
        !plan.captureIds.length
      ) {
        setNotice('Nothing to clean up: all stored audio is in use.');
        return false;
      }
      const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
      const parts = [
        plan.unused.length &&
          `${count(plan.unused.length, 'unused audio file', 'unused audio files')} (${formatBytes(plan.bytes)})`,
        plan.exports.length &&
          `${count(plan.exports.length, 'old temporary export copy', 'old temporary export copies')} (${formatBytes(plan.exportBytes)})`,
        plan.takeIds.length + plan.captureIds.length &&
          'recovery copies of takes already saved in this project',
      ].filter(Boolean);
      if (
        !window.confirm(
          `Remove ${parts.join(', ')}? Audio this project, the pending Learn transfer and unsaved recoverable takes use is kept. This cannot be undone.`
        )
      )
        return false;
      await runStorageCleanup(plan);
      setNotice(`Storage cleaned up: ${formatBytes(plan.bytes + plan.exportBytes)} removed.`);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Storage could not be cleaned up.');
      return false;
    }
  }, [activity, latest, saver, setNotice]);

  return {
    state,
    latest,
    actions,
    ready: state.restored && !projectPending,
    exportSession,
    importSession,
    newSession,
    downloadRecording,
    cleanUpStorage,
    backup,
    downloadBackup,
    clearBackup,
    downloadSetAside,
    discardSetAside,
  };
}
