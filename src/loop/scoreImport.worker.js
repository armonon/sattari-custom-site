import { importer, Settings } from '@coderline/alphatab';
import { scoreTracks } from './scoreImportModel';
self.onmessage = ({ data }) => {
  if (data.cmd !== 'loop.import') return;
  try {
    const score = importer.ScoreLoader.loadScoreFromBytes(
      new Uint8Array(data.bytes),
      new Settings()
    );
    const tracks = scoreTracks(score);
    if (!tracks.length) throw new Error('No playable guitar-range notes were found in this score.');
    self.postMessage({ tracks });
  } catch (error) {
    self.postMessage({ error: error.message || 'This score could not be read.' });
  }
};
