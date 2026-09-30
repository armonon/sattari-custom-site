import { analyzeSong } from './analyze';
import { CREPE_MODEL, transcribeNeural } from './neuralPitch';
import { POLYPHONIC_MODEL, transcribePolyphonic } from './polyphonic';
import { ort, loadNoteModel as loadModel } from './noteModelRuntime';

self.onmessage = async ({ data }) => {
  let session;
  const progress = (value, label) => self.postMessage({ progress: { value, label } });
  try {
    let notes;
    let polyphonicNotes;
    let harmonyFallback = false;
    let pitchFallback = false;
    progress(3, 'Preparing Auto Pitch note detection');
    try {
      // Loaded only with this worker; the library and live tuner stay light.
      // Reuse the same WASM assets as stem separation.
      session = await loadModel(CREPE_MODEL);
      notes = await transcribeNeural(data.samples, data.rate, ort, session, (value) =>
        progress(5 + value * 40, 'Finding the melody with Auto Pitch')
      );
    } catch {
      pitchFallback = true;
      progress(45, 'Using the standard note detector');
    } finally {
      await session?.release();
      session = null;
    }
    if (data.detail === 'harmony') {
      try {
        progress(46, 'Listening for chord tones');
        session = await loadModel(POLYPHONIC_MODEL);
        polyphonicNotes = await transcribePolyphonic(
          data.samples,
          data.rate,
          ort,
          session,
          (value) => progress(46 + value * 30, 'Finding overlapping notes')
        );
      } catch {
        harmonyFallback = true;
      } finally {
        await session?.release();
        session = null;
      }
    }
    const result = analyzeSong(
      data.samples,
      data.rate,
      (value, label) => progress(76 + value * 0.24, label),
      {
        notes,
        polyphonicNotes,
        harmonyFallback,
        pitchEngine: notes ? 'crepe-tiny' : 'single-note',
        pitchFallback,
        preparation: data.preparation,
        keySamples: data.keySamples,
        keyRate: data.keyRate,
      }
    );
    self.postMessage({ result });
  } catch {
    self.postMessage({
      error: 'This audio could not be analyzed. Try a shorter, clear guitar recording.',
    });
  }
};
