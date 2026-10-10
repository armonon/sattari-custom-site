import { wavBytes } from '../../utils/arrangementExport';
import { offerToLocker } from '../../suite/suiteKit';

export const LAB_RATE = 44100;

export function isAudioFile(file) {
  return (
    Boolean(file?.size) &&
    (file.type.startsWith('audio/') ||
      /\.(wav|mp3|flac|m4a|aac|ogg|opus|aiff?|webm)$/i.test(file.name || ''))
  );
}

/** Interleaves channels into a 24-bit PCM WAV blob. */
export function wavBlob(channels, rate = LAB_RATE) {
  const bytes = wavBytes({
    numberOfChannels: channels.length,
    length: channels[0].length,
    sampleRate: rate,
    getChannelData: (index) => channels[index],
  });
  return new Blob([bytes], { type: 'audio/wav' });
}

/** Decodes any browser-supported file to mono float samples at `rate`. */
export async function decodeMono(blob, rate = LAB_RATE) {
  const Decoder = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Decoder) throw new Error('Audio decoding is unavailable in this browser.');
  const context = new Decoder(1, 1, rate);
  let buffer;
  try {
    buffer = await context.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error('This file could not be decoded. Try a WAV, MP3 or M4A file.');
  }
  const samples = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) samples[i] += data[i] / buffer.numberOfChannels;
  }
  return { samples, rate, duration: buffer.duration };
}

export function downloadBlob(blob, name) {
  offerToLocker(blob, name);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function baseName(name) {
  return (
    String(name || 'track')
      .replace(/\.[^.]+$/, '')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\p{Cc}/gu, '_')
      .trim()
      .slice(0, 100) || 'track'
  );
}

export function peaksOf(samples, count = 240) {
  const peaks = new Float32Array(count);
  for (let bin = 0; bin < count; bin++) {
    const start = Math.floor((bin * samples.length) / count),
      end = Math.floor(((bin + 1) * samples.length) / count);
    for (let i = start; i < end; i++) peaks[bin] = Math.max(peaks[bin], Math.abs(samples[i]));
  }
  return peaks;
}
