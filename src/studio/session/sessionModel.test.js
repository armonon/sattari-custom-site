import { expect, it } from 'vitest';
import { deckIsFree, normalizeDeck } from './sessionModel';

it('restores a lane saved mid-load, with nothing stored yet, as empty', () => {
  const deck = normalizeDeck(
    { lanes: { fullMix: { status: 'loading', name: 'half-loaded.wav', assetId: '' } } },
    0
  );
  expect(deck.lanes.fullMix).toMatchObject({ status: 'empty', name: '', assetId: '' });
  expect(deckIsFree(deck)).toBe(true);
});

it('keeps lanes with stored audio for restore to reload', () => {
  const deck = normalizeDeck(
    { lanes: { fullMix: { status: 'loading', name: 'Learn track', assetId: 'audio-1' } } },
    0
  );
  expect(deck.lanes.fullMix).toMatchObject({ status: 'loading', assetId: 'audio-1' });
  const ready = normalizeDeck(
    { lanes: { vocals: { status: 'ready', name: 'Vox', assetId: 'audio-2', duration: 9 } } },
    1
  );
  expect(ready.lanes.vocals).toMatchObject({ status: 'ready', name: 'Vox', duration: 9 });
});
