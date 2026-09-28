import { analyzeAudioFile } from '../../utils/audioAnalysis';
import { putAudioAsset } from '../../utils/audioProjectStore';
import { getLibraryAudio, listLibraryTracks } from '../../utils/musicLibrary';
import { trackSiteEvent } from '../../utils/siteMeasurement';
import { createArrangement, deckIsFree, stemIdForFile } from '../session/sessionModel';

/**
 * Loading audio into decks: single lanes, stem sets, deck sets and library
 * songs. `current()` returns the latest rendered session.
 */
export function createDeckLoading({
  current,
  actions,
  activity,
  getEngine,
  objectUrlsRef,
  importToArranger,
  setActiveView,
  setNotice,
}) {
  const { updateDeck, setFocusedDeckId } = actions;

  const loadLane = async (deckId, laneId, file, cachedAnalysis = null) => {
    if (!file) return;
    if (activity.projectPending) {
      setNotice('Wait for the project to finish opening.');
      return;
    }
    const key = `${deckId}:${laneId}`;
    if (activity.loads.has(key)) {
      setNotice('Wait for this source to finish loading.');
      return;
    }
    activity.loads.add(key);
    const { decks, masterBpm } = current();
    const previousLane = decks.find((deck) => deck.id === deckId)?.lanes[laneId];
    setFocusedDeckId(deckId);
    updateDeck(deckId, (deck) => ({
      lanes: {
        ...deck.lanes,
        [laneId]: { ...deck.lanes[laneId], status: 'loading', name: file.name },
      },
    }));
    setNotice(`${laneId === 'fullMix' ? 'Analyzing' : 'Decoding'} ${file.name} locally...`);

    try {
      let analysis = null;
      if (laneId === 'fullMix') {
        const validBpm =
          Number.isFinite(cachedAnalysis?.bpm) &&
          cachedAnalysis.bpm >= 20 &&
          cachedAnalysis.bpm <= 400;
        const validKey = typeof cachedAnalysis?.key === 'string' && cachedAnalysis.key.trim();
        const complete =
          validBpm &&
          validKey &&
          Array.isArray(cachedAnalysis?.waveform) &&
          cachedAnalysis.waveform.length;
        analysis = complete ? { ...cachedAnalysis } : await analyzeAudioFile(file);
        // Library edits may contain only BPM or key; fill the remaining measured
        // data instead of propagating an undefined tempo / waveform into a deck.
        if (validBpm) analysis.bpm = cachedAnalysis.bpm;
        if (validKey) analysis.key = cachedAnalysis.key;
      }
      const asset = await putAudioAsset(file, { name: file.name, analysis, dedupe: true });
      const oldUrl = objectUrlsRef.current.get(key);
      const deck = decks.find((item) => item.id === deckId);
      const audio = getEngine();
      const duration = await audio.loadLane(deckId, deck.side, laneId, file);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      objectUrlsRef.current.delete(key);
      const laneState = {
        ...deck.lanes[laneId],
        assetId: asset.id,
        name: file.name,
        duration,
        status: 'ready',
      };
      audio.setLaneState(deckId, laneId, laneState);
      if (deck.stemFx[laneId]) audio.setLaneFx(deckId, laneId, deck.stemFx[laneId]);
      if (analysis) {
        await audio.setLoopRegion(
          deckId,
          deck.looping,
          0,
          Math.min(duration, (60 / analysis.bpm) * 4)
        );
        audio.setPlaybackRate(deckId, deck.synced ? masterBpm / analysis.bpm : 1);
      }

      updateDeck(deckId, (currentDeck) => {
        const lane = {
          ...currentDeck.lanes[laneId],
          assetId: asset.id,
          name: file.name.replace(/\.[^/.]+$/, ''),
          duration,
          status: 'ready',
        };
        const updates = {
          playing: false,
          lanes: { ...currentDeck.lanes, [laneId]: lane },
          duration: Math.max(currentDeck.duration, duration),
        };
        if (laneId === 'fullMix') updates.arrangement = createArrangement(duration);
        if (analysis) {
          Object.assign(updates, {
            title: file.name.replace(/\.[^/.]+$/, ''),
            keyName: analysis.key.replace(' major', ' maj').replace(' minor', ' min'),
            sourceKeyName: analysis.key.replace(' major', ' maj').replace(' minor', ' min'),
            bpm: analysis.bpm,
            beatOffset: 0,
            followTempoMap: false,
            duration,
            waveform: analysis.waveform,
            analysis,
            loopStart: 0,
            loopEnd: Math.min(duration, (60 / analysis.bpm) * 4),
          });
        }
        return updates;
      });
      setNotice(`${file.name} is ready in Deck ${deckId}.`);
      trackSiteEvent('studio_imported');
      return true;
    } catch (error) {
      updateDeck(deckId, (deck) => ({
        lanes: {
          ...deck.lanes,
          [laneId]: previousLane || { ...deck.lanes[laneId], status: 'error' },
        },
      }));
      setNotice(error instanceof Error ? error.message : 'Audio could not be loaded.');
    } finally {
      activity.loads.delete(key);
    }
  };

  const loadLibraryTrack = async (track, file, target) => {
    if (!current().restored || activity.projectPending) {
      setNotice('Wait for your session to finish opening before loading a library song.');
      return null;
    }
    // Recheck after the library's asynchronous blob read; never overwrite a deck
    // that was loaded while the user was browsing or another import was running.
    const deck = current().decks.find(
      (item) =>
        (target === 'auto' || item.id === target) &&
        deckIsFree(item) &&
        ![...activity.loads].some((key) => key.startsWith(`${item.id}:`))
    );
    if (!deck) {
      setNotice(
        'Choose an empty deck to load this song. Your existing tracks have not been replaced.'
      );
      return null;
    }
    return (await loadLane(deck.id, 'fullMix', file, track.analysis)) ? deck.id : null;
  };

  const loadStemSet = async (deckId, files) => {
    const audioFiles = files.filter((file) => file.type.startsWith('audio/') || !file.type);
    if (!audioFiles.length) return;
    setNotice(`Importing ${Math.min(audioFiles.length, 4)} separated stems into Deck ${deckId}...`);
    let imported = 0;
    for (const [index, file] of audioFiles.slice(0, 4).entries()) {
      if (await loadLane(deckId, stemIdForFile(file, index), file)) imported += 1;
    }
    if (imported === Math.min(audioFiles.length, 4)) {
      setNotice(`Stem set ready in Deck ${deckId}. Browser mode imported your separated files.`);
    } else {
      setNotice(
        `Imported ${imported} of ${Math.min(audioFiles.length, 4)} stems into Deck ${deckId}. Some files failed; retry the missing stems.`
      );
    }
  };

  const importDeckSet = async (files) => {
    const available = current().decks.filter(
      (deck) =>
        !deck.duration && !Object.values(deck.lanes).some((lane) => lane.status === 'loading')
    );
    if (!available.length) {
      setNotice(
        'All four decks are occupied. Click a deck title to replace its track, or save and start a new session.'
      );
      return;
    }
    for (const [index, file] of files.slice(0, available.length).entries()) {
      await loadLane(available[index].id, 'fullMix', file);
    }
    if (files.length > available.length)
      setNotice(
        `Loaded up to ${available.length} files. The remaining files were not imported because all decks are occupied.`
      );
  };

  const dropLibraryTrack = async (view, trackId) => {
    try {
      const track = (await listLibraryTracks()).find(
        (item) => item.id === trackId && !item.trashedAt
      );
      const blob = track && (await getLibraryAudio(trackId));
      if (!blob)
        throw new Error('Library audio is unavailable. Restore it from Trash or reimport it.');
      const file = new File([blob], track.name, { type: blob.type });
      if (view === 'arranger') {
        await importToArranger(file);
      } else if (view === 'decks') {
        const deckId = await loadLibraryTrack(track, file, 'auto');
        if (deckId) {
          setFocusedDeckId(deckId);
          setActiveView('decks');
        }
      }
    } catch (error) {
      setNotice(error.message);
    }
  };

  return { loadLane, loadLibraryTrack, loadStemSet, importDeckSet, dropLibraryTrack };
}
