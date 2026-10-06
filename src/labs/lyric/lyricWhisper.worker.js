// Module worker: transcribes the decoded song's vocal-ish mono PCM with an
// on-device Whisper ASR model and posts back raw word-level chunks. This is a
// free transcription pass only -- it has no idea what lyrics the visitor
// pasted in; lyricAlign.js does the actual matching on the main thread.
//
// @huggingface/transformers is imported lazily (inside getTranscriber, below)
// so the ~40-80MB Whisper model it will request is only ever pulled in once a
// visitor actually clicks "Align lyrics". See lyricWhisperModel.js for the
// model choice and its license chain.
import { WHISPER_MODEL, WHISPER_SAMPLE_RATE } from './lyricWhisperModel.js';
import { resampleLinear } from './lyricResample.js';

let transcriberPromise = null;

function getTranscriber(onProgress) {
  transcriberPromise ||= (async () => {
    const { pipeline } = await import('@huggingface/transformers');
    return pipeline('automatic-speech-recognition', WHISPER_MODEL, {
      progress_callback: (data) => onProgress?.(data),
    });
  })();
  return transcriberPromise;
}

self.onmessage = async ({ data }) => {
  if (data?.type !== 'transcribe') return;
  const { id, samples, rate } = data;
  try {
    const resampled = resampleLinear(samples, rate, WHISPER_SAMPLE_RATE);
    const transcriber = await getTranscriber((progress) =>
      self.postMessage({ type: 'progress', id, progress })
    );
    const result = await transcriber(resampled, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const chunks = (result?.chunks || []).map((chunk) => ({
      text: chunk.text,
      start: Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : null,
      end: Array.isArray(chunk.timestamp) ? chunk.timestamp[1] : null,
    }));
    self.postMessage({ type: 'done', id, chunks });
  } catch (error) {
    self.postMessage({ type: 'error', id, message: error?.message || 'Transcription failed.' });
  }
};
