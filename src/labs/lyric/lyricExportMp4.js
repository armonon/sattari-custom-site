// Fast MP4 export via WebCodecs (VideoEncoder/AudioEncoder) + mp4-muxer.
// Only reached through the dynamic import() in lyricExport.js's
// exportLyricVideo(), so this file -- and the mp4-muxer dependency it needs
// installed -- never has to load for the LRC/SRT/format-selection unit tests.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const VIDEO_CODEC = 'avc1.42001f'; // H.264 Constrained Baseline, broadly decodable
const AUDIO_CODEC = 'mp4a.40.2'; // AAC-LC
const VIDEO_BITRATE = 8_000_000;
const AUDIO_BITRATE = 192_000;
const KEYFRAME_INTERVAL_SECONDS = 2;
const AUDIO_CHUNK_SECONDS = 1;

/**
 * Renders `drawFrame(ctx, timeSeconds, width, height)` across `durationSeconds`
 * at `fps` into `canvas`, encodes it with VideoEncoder (and AudioEncoder for
 * `audioBuffer`, the full-quality decoded song audio), and muxes the result
 * into an MP4 with mp4-muxer. Can run faster than real time since nothing
 * here depends on wall-clock playback.
 * @returns {Promise<Blob>}
 */
export async function encodeLyricMp4({
  canvas,
  fps = 30,
  durationSeconds,
  drawFrame,
  audioBuffer,
  onProgress = () => {},
}) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    audio: audioBuffer
      ? {
          codec: 'aac',
          numberOfChannels: audioBuffer.numberOfChannels,
          sampleRate: audioBuffer.sampleRate,
        }
      : undefined,
    fastStart: 'in-memory',
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      throw error;
    },
  });
  videoEncoder.configure({
    codec: VIDEO_CODEC,
    width,
    height,
    bitrate: VIDEO_BITRATE,
    framerate: fps,
  });

  let audioEncoder = null;
  if (audioBuffer) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (error) => {
        throw error;
      },
    });
    audioEncoder.configure({
      codec: AUDIO_CODEC,
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate,
      bitrate: AUDIO_BITRATE,
    });
  }

  const totalFrames = Math.max(1, Math.round(durationSeconds * fps));
  const frameDurationUs = Math.round(1_000_000 / fps);
  const keyframeEveryNFrames = Math.max(1, Math.round(fps * KEYFRAME_INTERVAL_SECONDS));
  for (let i = 0; i < totalFrames; i++) {
    drawFrame(ctx, i / fps, width, height);
    const frame = new VideoFrame(canvas, {
      timestamp: i * frameDurationUs,
      duration: frameDurationUs,
    });
    videoEncoder.encode(frame, { keyFrame: i % keyframeEveryNFrames === 0 });
    frame.close();
    onProgress({ phase: 'video', progress: (i + 1) / totalFrames });
    // Basic backpressure: if the encoder's internal queue is backing up,
    // wait for it to drain before producing more frames.
    if (videoEncoder.encodeQueueSize > 4) {
      await new Promise((resolve) => {
        videoEncoder.ondequeue = resolve;
      });
    }
  }
  await videoEncoder.flush();
  videoEncoder.close();

  if (audioEncoder && audioBuffer) {
    const chunkFrames = Math.round(audioBuffer.sampleRate * AUDIO_CHUNK_SECONDS);
    const channels = audioBuffer.numberOfChannels;
    const channelData = Array.from({ length: channels }, (_, c) => audioBuffer.getChannelData(c));
    for (let start = 0; start < audioBuffer.length; start += chunkFrames) {
      const length = Math.min(chunkFrames, audioBuffer.length - start);
      const interleaved = new Float32Array(length * channels);
      for (let c = 0; c < channels; c++) {
        for (let i = 0; i < length; i++) interleaved[i * channels + c] = channelData[c][start + i];
      }
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: audioBuffer.sampleRate,
        numberOfFrames: length,
        numberOfChannels: channels,
        timestamp: Math.round((start / audioBuffer.sampleRate) * 1_000_000),
        data: interleaved,
      });
      audioEncoder.encode(audioData);
      audioData.close();
      onProgress({ phase: 'audio', progress: Math.min(1, (start + length) / audioBuffer.length) });
    }
    await audioEncoder.flush();
    audioEncoder.close();
  }

  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}
