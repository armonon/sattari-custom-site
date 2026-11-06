import { getAudioAsset } from '../../utils/audioProjectStore';
import { decodeTrack, safeTrackName } from '../../utils/stemSeparator';
import { StemSeparatorClient } from '../../utils/stemSeparatorClient';

export const SONGBOARD_STEMS = ['vocals', 'drums', 'bass', 'other'];

/**
 * Runs the site's verified HTDemucs worker against a deck's durable full-mix
 * asset and returns four File objects that the normal deck-loading path owns.
 * Keeping persistence and engine loading in that existing path means a split
 * survives reloads exactly like manually imported stems.
 */
export async function separateDeckAsset({
  deck,
  signal,
  onProgress = () => {},
  cpuOnly = false,
  readAsset = getAudioAsset,
  decode = decodeTrack,
  createClient = () => new StemSeparatorClient(),
}) {
  const sourceId = deck?.lanes?.fullMix?.assetId;
  if (!sourceId) throw new Error('Load an original track before separating stems.');

  const stored = await readAsset(sourceId);
  signal.throwIfAborted();
  if (!stored?.blob) throw new Error('The original track is missing. Relink it and try again.');

  const source = new File([stored.blob], stored.name || `${deck.title || 'track'}.wav`, {
    type: stored.type || stored.blob.type || 'audio/*',
    lastModified: 0,
  });
  onProgress({ message: 'Reading original track', progress: null });
  const audio = await decode(source, signal);
  signal.throwIfAborted();

  const client = createClient();
  try {
    const outputs = await client.separate(
      audio,
      SONGBOARD_STEMS,
      signal,
      onProgress,
      () => {},
      cpuOnly
    );
    signal.throwIfAborted();
    const title = safeTrackName(source.name);
    return outputs.map((output) => {
      const laneId = output.id === 'other' ? 'music' : output.id;
      return new File([output.blob], `${title}-${laneId}.wav`, {
        type: 'audio/wav',
        lastModified: 0,
      });
    });
  } finally {
    client.dispose();
  }
}
