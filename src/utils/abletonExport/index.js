// Browser side of "Export for Ableton": turns whatever audio a tool has
// (WAV/MP3 files, decoded AudioBuffers) into WAV bytes and builds the ZIP.
// Imported lazily so the Live Set template only loads when someone exports.
import { wavBytes } from '../arrangementExport';
import { buildAbletonPack, wavInfo } from './abletonPack';
import { WARP_MODES } from './liveSet';

export { WARP_MODES };

const DECODE_RATE = 44100;

async function decodeToWav(blob) {
  const Decoder = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Decoder) throw new Error('This browser cannot decode audio for the Ableton export.');
  const context = new Decoder(2, 1, DECODE_RATE);
  let buffer;
  try {
    buffer = await context.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error(`Could not decode "${blob.name || 'audio'}" for the Ableton export.`);
  }
  return wavBytes(buffer);
}

/** WAV bytes for a stem: WAV files pass through untouched, anything else is decoded to 24-bit WAV. */
export async function stemWavBytes({ blob, buffer }) {
  if (buffer) return wavBytes(buffer);
  if (!blob) throw new Error('Stem has no audio');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  try {
    const info = wavInfo(bytes);
    if ((info.format === 'pcm' || info.format === 'float') && info.frames > 0) return bytes;
  } catch {
    // Not a WAV Live can read as-is: decode below.
  }
  return decodeToWav(blob);
}

/**
 * Builds the "Export for Ableton" ZIP.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {number|null} options.bpm
 * @param {{app: string, tempoIsEstimate?: boolean}} options.source
 * @param {Array<{name: string, blob?: Blob, buffer?: AudioBuffer, color?: string,
 *   muted?: boolean, warpMode?: number}>} options.stems
 * @param {string[]} [options.notes]
 */
export async function exportForAbleton({ title, bpm, source, stems, notes }) {
  const prepared = [];
  for (const stem of stems) {
    prepared.push({
      name: stem.name,
      color: stem.color,
      muted: stem.muted,
      warpMode: stem.warpMode,
      data: await stemWavBytes(stem),
    });
  }
  return buildAbletonPack({ title, bpm, source, stems: prepared, notes });
}

/** Warp mode that suits a stem: Beats for drums, Complex for everything tonal. */
export function warpModeFor(stemId) {
  return /drum|kick|snare|hat|perc|clap/i.test(stemId) ? WARP_MODES.beats : WARP_MODES.complex;
}
