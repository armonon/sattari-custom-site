// Model choice and license chain for Lyric's on-device forced-alignment pass.
//
// Xenova/whisper-tiny.en -- an ONNX conversion of OpenAI's Whisper "tiny.en"
// weights -- is used for word-level ASR transcription, run entirely on the
// visitor's device via @huggingface/transformers ("transformers.js") on top
// of onnxruntime-web. No audio ever leaves the browser.
//
// License chain (every link permits commercial use with attribution; nothing
// here is GPL and nothing is bundled into this repository):
//   - OpenAI's Whisper model weights: MIT License.
//   - Xenova's ONNX conversion/hosting of Whisper on the Hugging Face Hub:
//     Apache License 2.0.
//   - @huggingface/transformers ("transformers.js"): Apache License 2.0.
//   - onnxruntime-web (already a dependency of this repo, also used by
//     Split's on-device HTDemucs pipeline): MIT License.
//
// The model weights are never bundled with this app: the browser streams
// them from the Hugging Face CDN the first time a visitor runs alignment,
// and the browser's own Cache Storage keeps them around after that -- the
// same loading pattern already used by ScenePilot's Captions tool for its
// on-device transcription model.
export const WHISPER_MODEL = 'Xenova/whisper-tiny.en';

// Whisper's published checkpoints are trained on 16 kHz mono audio; feeding
// anything else in produces garbage timestamps, so every caller must resample
// to this rate first (see lyricResample.js).
export const WHISPER_SAMPLE_RATE = 16000;
