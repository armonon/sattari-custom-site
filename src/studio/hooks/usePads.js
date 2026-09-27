import { useCallback, useEffect, useRef, useState } from 'react';
import { putAudioAsset } from '../../utils/audioProjectStore';
import { useLatest } from './useLatest';

const HIT_FLASH_MS = 150;

/** Performance pad triggering, sample loading and gain. */
export function usePads({ engine, session, activity, setNotice }) {
  const { getEngine, objectUrlsRef } = engine;
  const { setPads } = session.actions;
  const pads = useLatest(session.state.pads);
  const [activePad, setActivePad] = useState(null);
  const flash = useRef(0);

  useEffect(() => () => window.clearTimeout(flash.current), []);

  const triggerPad = useCallback(
    async (index) => {
      const pad = pads.current[index];
      // A new hit restarts the flash instead of being cut short by the previous one.
      window.clearTimeout(flash.current);
      setActivePad(index);
      flash.current = window.setTimeout(() => setActivePad(null), HIT_FLASH_MS);
      try {
        await getEngine().triggerPad(index, pad.frequency);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'The pad could not play. Check your audio output.'
        );
      }
    },
    [getEngine, pads, setNotice]
  );

  const loadPad = useCallback(
    async (index, file) => {
      if (!file) return;
      if (activity.projectPending) {
        setNotice('Wait for the project to finish opening.');
        return;
      }
      const key = `pad:${index}`;
      if (activity.loads.has(key)) {
        setNotice('Wait for this pad to finish loading.');
        return;
      }
      activity.loads.add(key);
      const { gain } = pads.current[index];
      let candidateUrl;
      try {
        const asset = await putAudioAsset(file, { name: file.name });
        const oldUrl = objectUrlsRef.current.get(key);
        const url = (candidateUrl = URL.createObjectURL(file));
        await getEngine().loadPad(index, url, gain);
        getEngine().capturePerformanceEvent?.('padSource', [index, { assetId: asset.id }, gain]);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        objectUrlsRef.current.set(key, url);
        candidateUrl = null;
        setPads((current) =>
          current.map((pad, padIndex) =>
            padIndex === index
              ? { ...pad, assetId: asset.id, name: file.name.replace(/\.[^/.]+$/, '') }
              : pad
          )
        );
        setNotice(`${file.name} loaded on Pad ${index + 1}.`);
      } catch (error) {
        if (candidateUrl) URL.revokeObjectURL(candidateUrl);
        setNotice(error instanceof Error ? error.message : 'Pad sample could not be loaded.');
      } finally {
        activity.loads.delete(key);
      }
    },
    [activity, getEngine, objectUrlsRef, pads, setNotice, setPads]
  );

  const changePadGain = useCallback(
    (index, gain) => {
      getEngine().setPadGain(index, gain);
      setPads((current) =>
        current.map((pad, padIndex) => (padIndex === index ? { ...pad, gain } : pad))
      );
    },
    [getEngine, setPads]
  );

  return { activePad, triggerPad, loadPad, changePadGain };
}
