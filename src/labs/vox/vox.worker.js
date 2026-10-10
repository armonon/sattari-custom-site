import { analysisMarks, detectVocalKey, renderVox, trackPitch, voicedRatio } from './voxDsp';

// Holds one vocal: tracking and pitch marks are computed once per take, each
// render only rebuilds the correction curve and the PSOLA output.
let take = null;

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'load') {
      const { samples, rate } = data;
      const track = trackPitch(samples, rate, (progress) =>
        self.postMessage({ type: 'progress', id: data.id, progress })
      );
      take = { id: data.id, samples, rate, track, marks: analysisMarks(samples, rate, track) };
      self.postMessage({
        type: 'loaded',
        id: data.id,
        key: detectVocalKey(track),
        voiced: voicedRatio(track),
        f0: track.f0.slice(),
        hopSeconds: track.hopSeconds,
        offsetSeconds: track.offsetSeconds,
      });
      return;
    }
    if (data.type === 'render') {
      if (!take || take.id !== data.id) return;
      const result = renderVox(take.samples, take.rate, take.track, data.options, take.marks);
      const transfer = [result.lead.buffer, result.mix.buffer, result.curve.buffer];
      if (result.harmony) transfer.push(result.harmony.buffer);
      self.postMessage({ type: 'rendered', id: data.id, serial: data.serial, ...result }, transfer);
    }
  } catch (error) {
    self.postMessage({ type: 'error', id: data.id, message: error?.message || 'Vox failed.' });
  }
};
