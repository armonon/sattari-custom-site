// In-memory handoff from the Split lab to StemDeck. The site is a single-page
// app, so a client-side navigation to /studio keeps this module's state; a full
// reload or a new tab does not (the user then imports the downloaded WAVs).

// Split (Demucs) source ids → StemDeck lane ids.
export const SPLIT_TO_STEMDECK_LANE = {
  drums: 'drums',
  bass: 'bass',
  other: 'music',
  vocals: 'vocals',
};

let pending = null;

/** fullMix: File; stems: [{ id: 'vocals'|'drums'|'bass'|'other', file: File }] */
export function offerStemHandoff({ title, fullMix, stems }) {
  pending = {
    title,
    fullMix,
    stems: stems
      .filter((stem) => SPLIT_TO_STEMDECK_LANE[stem.id] && stem.file)
      .map((stem) => ({ laneId: SPLIT_TO_STEMDECK_LANE[stem.id], file: stem.file })),
  };
  return pending;
}

export function hasStemHandoff() {
  return pending !== null;
}

export function takeStemHandoff() {
  const handoff = pending;
  pending = null;
  return handoff;
}
