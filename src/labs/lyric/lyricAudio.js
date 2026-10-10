// A small addition to the shared decodeMono() helper in
// src/labs/audio/audioLabFiles.js: Lyric needs the *full* (non mono-mixed)
// AudioBuffer too, for in-page playback and for feeding real audio into the
// exporter, while decodeMono() stays the right tool for the mono analysis
// buffer used by alignment and the audio-reactive background.
import { LAB_RATE } from '../audio/audioLabFiles';

/** Decodes a file to a full-quality AudioBuffer (original channel count) for playback/export. */
export async function decodeAudioBuffer(file, rate = LAB_RATE) {
  const Decoder = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Decoder) throw new Error('Audio decoding is unavailable in this browser.');
  const context = new Decoder(2, 1, rate);
  try {
    return await context.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error('This file could not be decoded. Try a WAV, MP3 or M4A file.');
  }
}
