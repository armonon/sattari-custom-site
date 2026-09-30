import { ort, loadNoteModel } from './noteModelRuntime';
import { POLYPHONIC_MODEL, transcribePolyphonic } from './polyphonic';
import { assessStrum, captureQuality } from './strumAssessment';
self.onmessage = async ({ data }) => {
  let session;
  try {
    if (
      !(data.samples instanceof Float32Array) ||
      !Number.isFinite(data.rate) ||
      data.rate < 8000 ||
      data.rate > 192000 ||
      data.samples.length < data.rate * 0.5 ||
      data.samples.length > data.rate * 4 ||
      !Array.isArray(data.expected) ||
      data.expected.length > 6 ||
      data.expected.some((m) => !Number.isInteger(m) || m < 40 || m > 84)
    )
      throw new Error('Invalid recording');
    const quality = captureQuality(data.samples, data.rate, data.noiseFloor);
    const preliminary = assessStrum([], data.expected, quality);
    if (['quiet', 'clipped', 'unavailable'].includes(preliminary.status)) {
      self.postMessage({ result: preliminary });
      return;
    }
    self.postMessage({ progress: 'Listening for the notes together' });
    session = await loadNoteModel(POLYPHONIC_MODEL);
    const notes = await transcribePolyphonic(data.samples, data.rate, ort, session);
    self.postMessage({ result: assessStrum(notes, data.expected, quality) });
  } catch {
    self.postMessage({
      error: 'The strum check could not finish. Try again, or check each string.',
    });
  } finally {
    await session?.release();
  }
};
