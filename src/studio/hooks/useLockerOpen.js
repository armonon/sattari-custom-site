import { useEffect, useRef, useState } from 'react';
import { deckIsFree } from '../session/sessionModel';
import { entryFile, useLockerOpen } from '../../suite/suiteKit';

const isAudio = (entry) =>
  /^audio\//.test(entry.type || '') ||
  /\.(wav|mp3|m4a|aac|flac|ogg|opus|aiff?)$/i.test(entry.name || '');

/**
 * Opens audio sent to StemDeck from the Locker or another suite app
 * (?tcc-open=…): it loads as the full mix of the first free deck, which runs
 * the usual tempo/key analysis, once the restored session is ready.
 */
export function useStemDeckLockerOpen({
  ready,
  decks,
  deckOps,
  actions,
  setActiveView,
  setNotice,
}) {
  const [pending, setPending] = useState(null);
  const latest = useRef({ decks, deckOps, actions, setActiveView, setNotice });
  latest.current = { decks, deckOps, actions, setActiveView, setNotice };

  useLockerOpen('stemdeck', (entry) => {
    if (isAudio(entry)) setPending(entryFile(entry));
    else
      latest.current.setNotice(
        `${entry.name} is not audio, so StemDeck cannot open it. Send a WAV, MP3, M4A or FLAC.`
      );
  });

  useEffect(() => {
    if (!ready || !pending) return;
    const file = pending;
    setPending(null);
    const {
      decks: current,
      deckOps: ops,
      actions: act,
      setActiveView: view,
      setNotice: notify,
    } = latest.current;
    const deck = current.find(deckIsFree);
    if (!deck) {
      notify(
        `All four decks are in use, so ${file.name} was not loaded. Clear a deck and open it again from the Locker.`
      );
      return;
    }
    void (async () => {
      view('decks');
      act.setFocusedDeckId(deck.id);
      if (await ops.loadLane(deck.id, 'fullMix', file))
        notify(`${file.name} from your Locker is loaded in Deck ${deck.id}.`);
    })();
  }, [ready, pending]);
}
