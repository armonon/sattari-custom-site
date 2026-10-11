import { encodeLyricMp4 } from '../lyric/lyricExportMp4';
import { featuresAt } from './canvasFeatures';
import { drawFrame } from './canvasScenes';

export function loopAudio(buffer, start, seconds, context) {
  const offset = Math.max(0, Math.round(start * buffer.sampleRate));
  const frames = Math.min(buffer.length - offset, Math.round(seconds * buffer.sampleRate));
  if (frames <= 0) throw new Error('The selected audio loop is empty.');
  const result = context.createBuffer(buffer.numberOfChannels, frames, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    result.copyToChannel(buffer.getChannelData(c).subarray(offset, offset + frames), c);
  }
  return result;
}

// A separate canvas and explicit frame timestamps keep the exported timeline
// independent of preview redraws, background tabs and encoder startup delays.
export async function encodeCanvasMp4({ size, settings, buffer, start = 0, context, onProgress }) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const seconds = settings.view.length;
  return encodeLyricMp4({
    canvas,
    durationSeconds: seconds,
    fps: 30,
    audioBuffer: buffer ? loopAudio(buffer, start, seconds, context) : undefined,
    onProgress,
    drawFrame: (ctx, t) => drawFrame(ctx, { ...settings, t, f: featuresAt(settings.view, t) }),
  });
}
