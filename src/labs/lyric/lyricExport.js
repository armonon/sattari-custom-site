// Export: LRC/SRT text formats (pure, instant) and video export orchestration.
//
// This file intentionally has no top-level import of `mp4-muxer` or any
// reference to WebCodecs types at module scope: the WebCodecs + mp4-muxer
// encoder lives in `lyricExportMp4.js` and is only ever reached through the
// dynamic `import()` inside `exportLyricVideo` below, so this file (and its
// pure LRC/SRT/format-selection logic) can be imported and unit tested
// without the `mp4-muxer` package installed.

export const EXPORT_SIZES = [
  { id: '9:16', width: 1080, height: 1920 },
  { id: '16:9', width: 1920, height: 1080 },
  { id: '1:1', width: 1080, height: 1080 },
];

function pad(value, length = 2) {
  return String(Math.trunc(value)).padStart(length, '0');
}

function lineText(line) {
  return (line.words || []).map((word) => word.text).join(' ');
}

/** Standard LRC: one `[mm:ss.xx]text` line per lyric line, sorted by start time. */
export function linesToLrc(lines) {
  return (lines || [])
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((line) => {
      const totalSeconds = Math.max(0, line.start || 0);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds - minutes * 60;
      const secondsText = seconds.toFixed(2).padStart(5, '0');
      return `[${pad(minutes)}:${secondsText}]${lineText(line)}`;
    })
    .join('\n');
}

function srtTimestamp(totalSeconds) {
  const clamped = Math.max(0, totalSeconds || 0);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = Math.floor(clamped % 60);
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

/** Standard SRT: one 1-indexed cue per lyric line, blank-line separated. */
export function linesToSrt(lines) {
  const rows = lines || [];
  if (!rows.length) return '';
  return (
    rows
      .map(
        (line, index) =>
          `${index + 1}\n${srtTimestamp(line.start)} --> ${srtTimestamp(line.end)}\n${lineText(line)}`
      )
      .join('\n\n') + '\n'
  );
}

// --- MediaRecorder fallback: format preference (mirrors the capability
// detection pattern in src/labs/canvas/canvasExport.js, written independently
// for Lyric's own candidate list and selection shape) ---

const RECORDER_CANDIDATES = [
  { id: 'mp4-avc', mimeType: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
  { id: 'mp4', mimeType: 'video/mp4', ext: 'mp4' },
  { id: 'webm-vp9', mimeType: 'video/webm;codecs=vp9', ext: 'webm' },
  { id: 'webm-vp8', mimeType: 'video/webm;codecs=vp8', ext: 'webm' },
  { id: 'webm', mimeType: 'video/webm', ext: 'webm' },
];

function safeSupports(isTypeSupported, type) {
  try {
    return Boolean(isTypeSupported(type));
  } catch {
    return false;
  }
}

export function recorderCandidates() {
  return RECORDER_CANDIDATES.slice();
}

/**
 * Picks the best MediaRecorder mime type this browser supports, preferring
 * MP4/H.264 and adding a named audio codec when `withAudio` is requested and
 * supported. Returns null if nothing in the candidate list is supported.
 * @param {(type: string) => boolean} isTypeSupported
 */
export function pickRecorderFormat(isTypeSupported, withAudio = true) {
  if (typeof isTypeSupported !== 'function') return null;
  for (const candidate of RECORDER_CANDIDATES) {
    if (!safeSupports(isTypeSupported, candidate.mimeType)) continue;
    let mimeType = candidate.mimeType;
    if (withAudio) {
      const withAudioType =
        candidate.ext === 'mp4'
          ? 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
          : `${candidate.mimeType.replace(/;codecs=.*/, '')};codecs=vp9,opus`;
      if (safeSupports(isTypeSupported, withAudioType)) mimeType = withAudioType;
    }
    return { ...candidate, mimeType };
  }
  return null;
}

/** True when this browser can take the fast WebCodecs + mp4-muxer export path. */
export function webCodecsSupported() {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined';
}

/**
 * Exports a lyric video by calling `drawFrame(ctx, timeSeconds, width, height)`
 * for a sequence of timestamps. Uses the fast WebCodecs + mp4-muxer path when
 * available (can run faster than real time), otherwise records in real time
 * via MediaRecorder + canvas.captureStream (the tab must stay visible for
 * that path to keep producing frames).
 * @returns {Promise<{ blob: Blob, ext: string, mode: 'webcodecs' | 'mediarecorder' }>}
 */
export async function exportLyricVideo(options) {
  if (webCodecsSupported()) {
    const { encodeLyricMp4 } = await import('./lyricExportMp4.js');
    const blob = await encodeLyricMp4(options);
    return { blob, ext: 'mp4', mode: 'webcodecs' };
  }
  const result = await exportViaMediaRecorder(options);
  return { ...result, mode: 'mediarecorder' };
}

async function exportViaMediaRecorder({
  canvas,
  fps = 30,
  durationSeconds,
  drawFrame,
  audioBuffer,
  onProgress = () => {},
}) {
  if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
    throw new Error('This browser cannot record video. Try a recent Chrome, Edge or Safari.');
  }
  const format = pickRecorderFormat(
    (type) => MediaRecorder.isTypeSupported(type),
    Boolean(audioBuffer)
  );
  if (!format) {
    throw new Error('This browser does not support any recordable video format here.');
  }

  const ctx = canvas.getContext('2d');
  const videoStream = canvas.captureStream(fps);
  let combinedStream = videoStream;
  let audioContext = null;
  if (audioBuffer) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
    const destination = audioContext.createMediaStreamDestination();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(destination);
    combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);
    source.start();
  }

  const recorder = new MediaRecorder(combinedStream, { mimeType: format.mimeType });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };
  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = (event) => reject(event.error || new Error('Recording failed.'));
  });

  recorder.start();
  const totalFrames = Math.max(1, Math.round(durationSeconds * fps));
  const frameIntervalMs = 1000 / fps;
  for (let i = 0; i < totalFrames; i++) {
    const time = i / fps;
    drawFrame(ctx, time, canvas.width, canvas.height);
    onProgress({ phase: 'video', progress: (i + 1) / totalFrames });
    // Real-time pacing: MediaRecorder captures whatever the canvas looks like
    // at each tick, so this loop must not outrun wall-clock playback.
    await new Promise((resolve) => setTimeout(resolve, frameIntervalMs));
  }
  recorder.stop();
  await stopped;
  if (audioContext) await audioContext.close();

  return { blob: new Blob(chunks, { type: format.mimeType.split(';')[0] }), ext: format.ext };
}
