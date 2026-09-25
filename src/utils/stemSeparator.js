export const STEMS = [
  { id: 'vocals', label: 'Vocals', color: '#e998bc' },
  { id: 'drums', label: 'Drums', color: '#e4b873' },
  { id: 'bass', label: 'Bass', color: '#83c7ee' },
  { id: 'other', label: 'Instruments', color: '#93d2ad' },
];
export const SAMPLE_RATE = 44100;
export const LIMITS = {
  tracks: 20,
  fileBytes: 100 * 1024 ** 2,
  inputBytes: 300 * 1024 ** 2,
  outputBytes: 512 * 1024 ** 2,
  seconds: 600,
};
export const AUDIO_ACCEPT = 'audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg,.opus,.aif,.aiff,.webm';

export function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function validateFiles(files, existing = []) {
  const accepted = [],
    errors = [];
  const seen = new Set(existing.map((job) => fileKey(job.file)));
  let total = existing.reduce((sum, job) => sum + job.file.size, 0);
  for (const file of files) {
    const key = fileKey(file);
    let reason = '';
    if (!file.size) reason = 'File is empty.';
    else if (
      !file.type.startsWith('audio/') &&
      !/\.(wav|mp3|flac|m4a|aac|ogg|opus|aiff?|webm)$/i.test(file.name)
    )
      reason = 'Choose an audio file.';
    else if (seen.has(key)) reason = 'Already in the queue.';
    else if (file.size > LIMITS.fileBytes) reason = 'Maximum file size is 100 MB.';
    else if (existing.length + accepted.length >= LIMITS.tracks)
      reason = 'Maximum 20 tracks per batch.';
    else if (total + file.size > LIMITS.inputBytes)
      reason = 'This queue exceeds 300 MB. Remove some tracks first.';
    if (reason) errors.push(`${file.name}: ${reason}`);
    else {
      accepted.push(file);
      seen.add(key);
      total += file.size;
    }
  }
  return { accepted, errors };
}

export function selectedStemIds(ids) {
  return STEMS.filter((stem) => ids.includes(stem.id)).map((stem) => stem.id);
}

export function safeTrackName(name) {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\p{Cc}/gu, '_')
      .replace(/^\.+/, '')
      .trim()
      .slice(0, 100) || 'track'
  );
}

export function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function waveformPeaks(channels, count = 160) {
  const peaks = new Float32Array(count);
  const length = channels[0].length;
  for (let bin = 0; bin < count; bin++) {
    const start = Math.floor((bin * length) / count),
      end = Math.floor(((bin + 1) * length) / count);
    for (let i = start; i < end; i++) {
      for (const channel of channels) peaks[bin] = Math.max(peaks[bin], Math.abs(channel[i]));
    }
  }
  return peaks;
}

export async function decodeTrack(file, signal) {
  signal.throwIfAborted();
  const Decoder = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Decoder)
    throw new Error(
      'Audio decoding is unavailable in this browser. Try a current desktop browser.'
    );
  const decoder = new Decoder(2, 1, SAMPLE_RATE);
  let buffer;
  try {
    buffer = await decoder.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error('This file could not be decoded. Try a WAV, MP3, or FLAC export.');
  }
  signal.throwIfAborted();
  if (!buffer.length || buffer.duration > LIMITS.seconds)
    throw new Error('Tracks must be between 0 and 10 minutes long.');
  if (buffer.numberOfChannels > 2)
    throw new Error('Export a mono or stereo mix first; surround audio is not supported.');
  const left = buffer.getChannelData(0).slice();
  const right = buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0).slice();
  return { left, right, duration: buffer.duration, peaks: waveformPeaks([left, right]) };
}
