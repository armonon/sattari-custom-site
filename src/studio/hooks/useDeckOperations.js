import { useEffect, useMemo, useRef } from 'react';
import { migrateArrangement } from '../../utils/arrangementModel';
import { SEND_BUSES } from '../mixer/mixerModel';
import {
  DECK_IDS,
  buildMidiPattern,
  keyPitchClass,
  nearestSemitoneShift,
} from '../session/sessionModel';
import { createDeckLoading } from './deckLoading';
import { downloadBlob } from '../downloads';
import { useLatest } from './useLatest';

/**
 * Deck loading, transport, cue, loop and sync operations. Every operation is
 * stable and reads the latest rendered session when called, exactly as the
 * render closures it replaces did, so memoized children never re-render
 * because a handler changed.
 */
export function useDeckOperations({
  engine,
  session,
  arranger,
  arrangerRef,
  activity,
  transport,
  activeView,
  setActiveView,
  setNotice,
}) {
  const { getEngine, objectUrlsRef } = engine;
  const { actions } = session;
  const { applyEdit, importToArranger } = arranger;
  const context = useLatest({
    session: session.state,
    activeView,
    arrangerPlaying: arranger.arrangerPlaying,
  });
  const transportPending = useRef(false);

  const operations = useMemo(() => {
    const { updateDeck, setDecks, setMasterBpm, setMasterDeckId, setCrossfader } = actions;
    const current = () => context.current.session;
    const stopAllDecks = () =>
      setDecks((decks) => decks.map((deck) => ({ ...deck, playing: false })));

    const loading = createDeckLoading({
      current,
      actions,
      activity,
      getEngine,
      objectUrlsRef,
      importToArranger,
      setActiveView,
      setNotice,
    });

    const tempoForSync = (reference) => {
      const { masterBpm } = current();
      const live = reference && getEngine().decks?.get(reference.id);
      const tempo = live?.playing ? reference.bpm * live.playbackRate : masterBpm;
      if (tempo !== masterBpm) setMasterBpm(tempo);
      return tempo;
    };

    const changeDeck = async (deckId, updates) => {
      const { decks, masterBpm, masterDeckId } = current();
      if (updates.masterDeck) {
        setMasterDeckId(deckId);
        const selected = decks.find((deck) => deck.id === deckId);
        if (selected?.duration)
          setMasterBpm(selected.bpm * (getEngine().decks?.get(deckId)?.playbackRate || 1));
        setNotice(`Deck ${deckId} is the sync master.`);
        return;
      }
      if (updates.alignBeat) {
        const selected = decks.find((deck) => deck.id === deckId);
        const reference = decks.find((deck) => deck.id === masterDeckId && deck.id !== deckId);
        void getEngine()
          .alignDeck(deckId, selected, reference, tempoForSync(reference))
          .then((aligned) => {
            if (!aligned) {
              setNotice(`Load audio into Deck ${deckId} before aligning beats.`);
              return;
            }
            updateDeck(deckId, { synced: true });
            setNotice(
              `Deck ${deckId} aligned to the ${reference?.playing ? 'master deck' : 'project clock'} beat grid. Check the grid by ear.`
            );
          })
          .catch((error) => setNotice(error.message));
        return;
      }
      const deck = decks.find((item) => item.id === deckId);
      if (!deck) return;
      const nextDeck = { ...deck, ...updates };
      const audio = getEngine();
      if ('gain' in updates) audio.setDeckGain(deckId, updates.gain);
      if ('fader' in updates) audio.setDeckFader(deckId, updates.fader);
      if ('cfSide' in updates) audio.setDeckSide(deckId, updates.cfSide);
      if ('eq' in updates) audio.setDeckEq(deckId, updates.eq);
      if ('filter' in updates) audio.setDeckFilter(deckId, updates.filter);
      if ('fx' in updates) audio.setDeckFx(deckId, updates.fx);
      if ('pitch' in updates) audio.setDeckPitch(deckId, updates.pitch);
      if ('keyLock' in updates) audio.setDeckKeyLock(deckId, updates.keyLock);
      if ('sends' in updates)
        for (const bus of SEND_BUSES)
          if (updates.sends[bus] !== deck.sends[bus])
            audio.setDeckSend?.(deckId, bus, updates.sends[bus]);
      if ('cue' in updates) audio.setDeckCue?.(deckId, updates.cue);
      if ('inserts' in updates) audio.setDeckInserts?.(deckId, updates.inserts);
      if ('looping' in updates || 'loopStart' in updates || 'loopEnd' in updates) {
        if (
          (await audio.setLoopRegion(
            deckId,
            nextDeck.looping,
            nextDeck.loopStart,
            nextDeck.loopEnd
          )) === false
        ) {
          setNotice(audio.getDeckTransportStatus?.(deckId).error || 'Loop change cancelled.');
          return;
        }
      }
      if ('synced' in updates || 'bpm' in updates) {
        audio.setPlaybackRate(deckId, nextDeck.synced ? masterBpm / Math.max(1, nextDeck.bpm) : 1);
        audio.setDeckSync?.(
          deckId,
          nextDeck.synced && deckId !== masterDeckId,
          nextDeck,
          decks.find((item) => item.id === masterDeckId && item.id !== deckId)
        );
      }
      updateDeck(deckId, updates);
    };

    const changeLane = (deckId, laneId, updates) => {
      getEngine().setLaneState(deckId, laneId, updates);
      updateDeck(deckId, (deck) => ({
        lanes: { ...deck.lanes, [laneId]: { ...deck.lanes[laneId], ...updates } },
      }));
    };

    const changeStemFx = (deckId, stemId, updates) => {
      getEngine().setLaneFx(deckId, stemId, updates);
      if ('pitch' in updates) getEngine().setStemPitch(deckId, stemId, updates.pitch);
      updateDeck(deckId, (deck) => ({
        stemFx: {
          ...deck.stemFx,
          [stemId]: { ...deck.stemFx[stemId], ...updates },
        },
      }));
    };

    const toggleDeck = async (deckId) => {
      if (transportPending.current) return;
      const { decks, masterDeckId } = current();
      const deck = decks.find((item) => item.id === deckId);
      if (!deck) return;
      const audio = getEngine();
      transportPending.current = true;
      try {
        if (deck.playing) {
          window.clearInterval(activity.automix);
          audio.pauseDeck(deckId);
          updateDeck(deckId, { playing: false });
        } else if (
          await (deck.synced
            ? audio.alignDeck(
                deckId,
                deck,
                decks.find((item) => item.id === masterDeckId && item.id !== deckId),
                tempoForSync(decks.find((item) => item.id === masterDeckId && item.id !== deckId)),
                true
              )
            : audio.playDeck(deckId))
        ) {
          updateDeck(deckId, { playing: true });
        } else {
          setNotice(
            audio.getDeckTransportStatus?.(deckId).error ||
              `Deck ${deckId} did not start. Load audio or retry playback.`
          );
        }
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'Playback could not start. Check your audio output and try again.'
        );
      } finally {
        transportPending.current = false;
      }
    };

    const cueDeck = (deckId) => {
      window.clearInterval(activity.automix);
      const audio = getEngine();
      audio.stopDeck(deckId);
      audio.seekDeck(deckId, 0);
      updateDeck(deckId, { playing: false });
      transport.setPosition(deckId, 0);
    };

    const toggleGlobalTransport = async () => {
      if (context.current.activeView === 'arranger' || context.current.arrangerPlaying) {
        await arrangerRef.current?.toggle();
        return;
      }
      if (transportPending.current) return;
      transportPending.current = true;
      try {
        const loaded = current().decks.filter((deck) => deck.duration);
        if (loaded.some((deck) => deck.playing)) {
          window.clearInterval(activity.automix);
          getEngine().pauseAll();
          stopAllDecks();
          return;
        }
        const started = await getEngine().playAll();
        setDecks((decks) => decks.map((deck) => ({ ...deck, playing: started.includes(deck.id) })));
        if (!started.length) setNotice('Load a track before starting playback.');
      } catch (error) {
        getEngine().pauseAll();
        stopAllDecks();
        setNotice(
          error instanceof Error
            ? error.message
            : 'Playback could not start. Check your audio output and try again.'
        );
      } finally {
        transportPending.current = false;
      }
    };

    const seekTo = async (deckId, seconds) => {
      try {
        const audio = getEngine();
        const pending = audio.seekDeck(deckId, seconds);
        if (audio.getDeckTransportStatus?.(deckId).preparing)
          setNotice(`Preparing Deck ${deckId}…`);
        if ((await pending) === false) {
          const error = audio.getDeckTransportStatus?.(deckId).error;
          if (error) setNotice(`Deck ${deckId}: ${error}`);
          return;
        }
        transport.setPosition(deckId, audio.getDeckPosition(deckId));
        setNotice(`Deck ${deckId} ready.`);
      } catch (error) {
        setNotice(error.message || 'Could not seek. Your source is unchanged.');
      }
    };

    const setHotCue = (deckId, index, seconds) => {
      const deck = current().decks.find((item) => item.id === deckId);
      if (deck.hotCues[index] !== null) {
        void seekTo(deckId, seconds);
        return;
      }
      updateDeck(deckId, (currentDeck) => {
        const hotCues = [...currentDeck.hotCues];
        hotCues[index] = seconds;
        return { hotCues };
      });
    };

    const deleteHotCue = (deckId, index) => {
      updateDeck(deckId, (deck) => {
        const hotCues = [...deck.hotCues];
        hotCues[index] = null;
        return { hotCues };
      });
    };

    const setDeckLoop = async (deckId, enabled, start, end, roll = null) => {
      const deck = current().decks.find((item) => item.id === deckId);
      const beat = 60 / Math.max(1, deck.bpm);
      const rollLength = roll ? beat * Number(roll.split('/').reduce((a, b) => a / b)) : null;
      const loopStart = Math.max(0, start || 0);
      const loopEnd = Math.min(
        deck.duration || Infinity,
        rollLength ? loopStart + rollLength : end
      );
      const audio = getEngine();
      if ((await audio.setLoopRegion(deckId, enabled, loopStart, loopEnd)) === false) {
        setNotice(audio.getDeckTransportStatus?.(deckId).error || 'Loop change cancelled.');
        return;
      }
      updateDeck(deckId, { looping: enabled, loopStart, loopEnd });
    };

    const beatJump = (deckId, beats) => {
      const deck = current().decks.find((item) => item.id === deckId);
      const seconds = Math.max(
        0,
        transport.getPosition(deckId) + beats * (60 / Math.max(1, deck.bpm))
      );
      void seekTo(deckId, seconds);
    };

    const extractPattern = (deckId, kind) => {
      const deck = current().decks.find((item) => item.id === deckId);
      const pattern = migrateArrangement({
        decks: [],
        pianoNotes: buildMidiPattern(kind, deck.bpm),
        masterBpm: deck.bpm,
      });
      applyEdit((project) => ({ ...project, tracks: [...project.tracks, ...pattern.tracks] }));
      setActiveView('arranger');
      setNotice(
        `${kind === 'drums' ? 'Drum' : 'Pitch'} instrument template created at Deck ${deckId}'s tempo. This is a playable template, not audio-to-MIDI transcription.`
      );
    };

    const exportAbleton = async (deckId) => {
      const deck = current().decks.find((item) => item.id === deckId);
      setNotice(`Preparing Deck ${deckId} for Ableton…`);
      try {
        const { exportDeckForAbleton } = await import('../abletonDeckExport');
        const pack = await exportDeckForAbleton(deck);
        downloadBlob(pack.blob, pack.fileName, 60000);
        setNotice(
          `Exported ${pack.fileName}: unzip it and open ${pack.setName} in Ableton Live 12.`
        );
      } catch (error) {
        setNotice(`Ableton export failed: ${error.message}`);
      }
    };

    const syncAll = () => {
      const { decks, masterDeckId } = current();
      const reference = decks.find((item) => item.id === masterDeckId);
      const tempo = tempoForSync(reference);
      // Joining the project clock at its CURRENT audible tempo preserves the
      // leader, while allowing subsequent project BPM edits to move the whole set.
      if (reference?.duration) updateDeck(reference.id, { synced: true });
      void Promise.all(
        decks
          .filter((deck) => deck.duration && deck.id !== masterDeckId)
          .map(async (deck) => {
            const aligned = await getEngine().alignDeck(deck.id, deck, reference, tempo);
            if (aligned) updateDeck(deck.id, { synced: true });
            return aligned;
          })
      )
        .then(() =>
          setNotice(
            `Followers aligned to ${tempo.toFixed(1)} BPM; leader position preserved. Verify each beat grid.`
          )
        )
        .catch((error) => setNotice(error.message));
    };

    const syncKey = () => {
      const { decks, masterDeckId, projectKey } = current();
      const master = decks.find((deck) => deck.id === masterDeckId);
      const masterKey = keyPitchClass(master?.sourceKeyName || master?.keyName);
      const selectedKey = keyPitchClass(projectKey);
      if (projectKey === 'Off' && (!master?.duration || masterKey === undefined)) {
        setNotice('Load the sync master before matching keys.');
        return;
      }
      const target = selectedKey ?? (masterKey + master.pitch + 12) % 12;
      const targetLabel = projectKey === 'Off' ? master.keyName : projectKey;
      // Engine changes happen here, once; the state updater below stays pure.
      const pitches = new Map();
      for (const deck of decks) {
        if (!deck.duration) continue;
        const sourceKey = keyPitchClass(deck.sourceKeyName || deck.keyName);
        if (sourceKey === undefined) continue;
        const pitch = nearestSemitoneShift(sourceKey, target);
        getEngine().setDeckPitch(deck.id, pitch);
        getEngine().setDeckKeyLock(deck.id, true);
        pitches.set(deck.id, pitch);
      }
      setDecks((currentDecks) =>
        currentDecks.map((deck) =>
          pitches.has(deck.id) ? { ...deck, pitch: pitches.get(deck.id), keyLock: true } : deck
        )
      );
      setNotice(`Loaded decks harmonically matched to ${targetLabel} without changing tempo.`);
    };

    const toggleAllKeyLock = () => {
      const { decks } = current();
      const enabled = !decks.every((deck) => deck.keyLock);
      decks.forEach((deck) => getEngine().setDeckKeyLock(deck.id, enabled));
      setDecks((currentDecks) => currentDecks.map((deck) => ({ ...deck, keyLock: enabled })));
      setNotice(`Pitch lock ${enabled ? 'enabled' : 'disabled'} for every deck.`);
    };

    const startAutomix = async () => {
      if (transportPending.current) return;
      window.clearInterval(activity.automix);
      const { decks, crossfaderReverse } = current();
      const loaded = decks.filter((deck) => deck.duration);
      if (loaded.length < 2) {
        setNotice('Load at least two decks to run AutoMix.');
        return;
      }
      const [source, target] = loaded;
      transportPending.current = true;
      try {
        if (!(await getEngine().playDeck(source.id)) || !(await getEngine().playDeck(target.id))) {
          throw new Error('AutoMix needs two decks with playable audio. Reload the missing track.');
        }
        changeDeck(source.id, { playing: true, cfSide: 'left' });
        changeDeck(target.id, { playing: true, cfSide: 'right' });
        let value = crossfaderReverse ? 100 : 0;
        const destination = crossfaderReverse ? 0 : 100;
        const direction = destination > value ? 1 : -1;
        setCrossfader(value);
        activity.automix = window.setInterval(() => {
          value =
            direction > 0 ? Math.min(destination, value + 2) : Math.max(destination, value - 2);
          setCrossfader(Math.min(100, Math.max(0, value)));
          if (value === destination) {
            window.clearInterval(activity.automix);
          }
        }, 90);
      } catch (error) {
        getEngine().pauseAll();
        stopAllDecks();
        setNotice(error instanceof Error ? error.message : 'AutoMix could not start.');
      } finally {
        transportPending.current = false;
      }
    };

    return {
      ...loading,
      changeDeck,
      changeLane,
      changeStemFx,
      toggleDeck,
      cueDeck,
      toggleGlobalTransport,
      seekTo,
      setHotCue,
      deleteHotCue,
      setDeckLoop,
      beatJump,
      extractPattern,
      exportAbleton,
      syncAll,
      syncKey,
      toggleAllKeyLock,
      startAutomix,
    };
  }, [
    actions,
    activity,
    applyEdit,
    arrangerRef,
    context,
    getEngine,
    importToArranger,
    objectUrlsRef,
    setActiveView,
    setNotice,
    transport,
  ]);

  // Handlers bound to one deck, stable so a memoized deck channel re-renders
  // only when its own deck changes.
  const deckHandlers = useMemo(
    () =>
      Object.fromEntries(
        DECK_IDS.map((id) => [
          id,
          {
            onLoadLane: (laneId, file) => operations.loadLane(id, laneId, file),
            onLoadStemSet: (files) => operations.loadStemSet(id, files),
            onDeckChange: (updates) => operations.changeDeck(id, updates),
            onLaneChange: (laneId, updates) => operations.changeLane(id, laneId, updates),
            onTogglePlay: () => operations.toggleDeck(id),
            onCue: () => operations.cueDeck(id),
            onSeek: (seconds) => operations.seekTo(id, seconds),
            onSetHotCue: (index, seconds) => operations.setHotCue(id, index, seconds),
            onDeleteHotCue: (index) => operations.deleteHotCue(id, index),
            onSetLoop: (enabled, start, end, roll) =>
              operations.setDeckLoop(id, enabled, start, end, roll),
            onBeatJump: (beats) => operations.beatJump(id, beats),
            onStemFxChange: (stemId, updates) => operations.changeStemFx(id, stemId, updates),
            onExtractMidi: () => operations.extractPattern(id, 'midi'),
            onExtractDrums: () => operations.extractPattern(id, 'drums'),
            onExportAbleton: () => operations.exportAbleton(id),
          },
        ])
      ),
    [operations]
  );

  // Push deck mix, sync and tempo-follow state to the engine. The view is a
  // dependency so switching workspaces re-asserts the engine state.
  const { decks, masterBpm, masterDeckId } = session.state;
  useEffect(() => {
    const audio = getEngine();
    const soloed = decks.filter((deck) => deck.solo);
    audio.setProjectTempo?.(masterBpm);
    decks.forEach((deck) => {
      audio.setDeckFader(deck.id, !deck.muted && (!soloed.length || deck.solo) ? deck.fader : 0);
      const tempoMap = deck.synced && deck.followTempoMap ? deck.analysis?.tempoMap?.beats : null;
      // The sync controller owns follower rates, and the engine's tempo follower
      // owns the rate of a deck it follows (a map of two or more beats). UI
      // redraws must not overwrite either with the nominal BPM ratio.
      if ((!deck.synced || deck.id === masterDeckId) && !(tempoMap?.length > 1))
        audio.setPlaybackRate(deck.id, deck.synced ? masterBpm / Math.max(1, deck.bpm) : 1);
      audio.setDeckSync?.(
        deck.id,
        deck.synced && deck.id !== masterDeckId,
        deck,
        decks.find((item) => item.id === masterDeckId && item.id !== deck.id)
      );
      audio.setTempoFollow?.(deck.id, tempoMap, masterBpm);
      audio.setDeckFilter(deck.id, deck.filter);
      audio.setDeckFx(deck.id, deck.fx);
    });
  }, [activeView, decks, getEngine, masterBpm, masterDeckId]);

  // AutoMix must not keep moving the crossfader after the page unmounts.
  useEffect(() => () => window.clearInterval(activity.automix), [activity]);

  return { ...operations, deckHandlers };
}
