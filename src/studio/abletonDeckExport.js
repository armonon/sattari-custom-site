// StemDeck → "Export for Ableton": one deck's loaded audio (stems plus the full
// mix, muted when stems exist) as WAVs and a Live Set at the deck's tempo.
import { getAudioAsset } from '../utils/audioProjectStore';

// Track order and colours match the deck's stem lanes (StemDeckChannel).
const LANES = [
  { id: 'vocals', name: 'Vocals', color: '#d4537e' },
  { id: 'drums', name: 'Drums', color: '#4a9eff' },
  { id: 'bass', name: 'Bass', color: '#4ad9c4' },
  { id: 'music', name: 'Music', color: '#888780' },
  { id: 'fullMix', name: 'Full mix', color: '#d0d0d0' },
];

/** Lanes of a deck that hold audio, in export order. */
export function exportableLanes(deck) {
  return LANES.filter(({ id }) => deck?.lanes?.[id]?.status === 'ready' && deck.lanes[id].assetId);
}

export async function exportDeckForAbleton(deck) {
  const lanes = exportableLanes(deck);
  if (!lanes.length) throw new Error(`Deck ${deck?.id ?? ''} has no audio to export yet.`);
  const hasStems = lanes.some(({ id }) => id !== 'fullMix');
  const { exportForAbleton, warpModeFor } = await import('../utils/abletonExport');
  const stems = [];
  for (const lane of lanes) {
    const asset = await getAudioAsset(deck.lanes[lane.id].assetId);
    if (!asset?.blob) throw new Error(`${lane.name} audio is missing from this browser's storage.`);
    stems.push({
      name: lane.name,
      color: lane.color,
      warpMode: warpModeFor(lane.id),
      // The full mix is a reference when stems are present; unmuted, it would double them.
      muted: lane.id === 'fullMix' && hasStems,
      blob: asset.blob,
    });
  }
  const detected = Number(deck.analysis?.bpm);
  return exportForAbleton({
    title: deck.title && deck.title !== 'Empty deck' ? deck.title : `StemDeck Deck ${deck.id}`,
    bpm: deck.bpm,
    source: {
      app: 'StemDeck',
      // Detected unless someone typed a tempo into the deck.
      tempoIsEstimate: Number.isFinite(detected) && Math.abs(detected - deck.bpm) < 0.01,
    },
    stems,
    notes: [
      'The files are the source audio of the deck. Deck pitch, EQ, effects, loops and levels are not baked in.',
    ],
  });
}
