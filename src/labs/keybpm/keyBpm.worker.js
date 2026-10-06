import { safeAnalyzeStemAudio } from '../../utils/stemMusicalAnalysis';
import { roughTempo } from './keyBpm';

// One file at a time; the page decodes (Web Audio is main-thread only) and
// transfers the PCM here so long scans never block the interface.
self.onmessage = ({ data: { id, left, right, channels, rate } }) => {
  try {
    const analysis = safeAnalyzeStemAudio(left, right, rate, { channels });
    const rough =
      analysis.status === 'ready' &&
      analysis.bpm === null &&
      ['variable', 'no-pulse'].includes(analysis.tempoReason)
        ? roughTempo(left, right, rate)
        : null;
    self.postMessage({ id, analysis, rough });
  } catch (error) {
    self.postMessage({ id, error: error?.message || 'Analysis failed.' });
  }
};
