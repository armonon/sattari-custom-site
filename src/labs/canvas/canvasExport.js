// Video formats MediaRecorder can produce from a canvas in this browser.
// MP4 (H.264) comes first where supported: Spotify Canvas only accepts MP4.
const CANDIDATES = [
  { id: 'mp4-avc', label: 'MP4 (H.264)', mimeType: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
  { id: 'mp4', label: 'MP4', mimeType: 'video/mp4', ext: 'mp4' },
  { id: 'webm-vp9', label: 'WebM (VP9)', mimeType: 'video/webm;codecs=vp9', ext: 'webm' },
  { id: 'webm-vp8', label: 'WebM (VP8)', mimeType: 'video/webm;codecs=vp8', ext: 'webm' },
  { id: 'webm', label: 'WebM', mimeType: 'video/webm', ext: 'webm' },
];

export const EXPORT_SIZES = [
  { id: '720', label: '720 × 1280', width: 720, height: 1280 },
  { id: '1080', label: '1080 × 1920', width: 1080, height: 1920 },
];

export const LOOP_LENGTHS = [4, 6, 8, 15];

function supports(isTypeSupported, type) {
  try {
    return Boolean(isTypeSupported(type));
  } catch {
    return false;
  }
}

/**
 * Supported formats, best first, at most one per container.
 * @param {(type: string) => boolean} isTypeSupported
 */
export function supportedFormats(isTypeSupported) {
  if (typeof isTypeSupported !== 'function') return [];
  const out = [];
  for (const candidate of CANDIDATES) {
    if (
      supports(isTypeSupported, candidate.mimeType) &&
      !out.some((format) => format.ext === candidate.ext)
    )
      out.push(candidate);
  }
  return out;
}

/** The mime type to request, adding an audio codec when the format needs one named. */
export function recorderMimeType(format, withAudio, isTypeSupported) {
  if (!withAudio) return format.mimeType;
  const options =
    format.ext === 'mp4'
      ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', format.mimeType]
      : [`${format.mimeType.replace(/;codecs=.*/, '')};codecs=vp9,opus`, format.mimeType];
  return options.find((type) => supports(isTypeSupported, type)) || format.mimeType;
}

export function browserFormats() {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined') return [];
  if (!('captureStream' in HTMLCanvasElement.prototype)) return [];
  return supportedFormats((type) => MediaRecorder.isTypeSupported(type));
}
