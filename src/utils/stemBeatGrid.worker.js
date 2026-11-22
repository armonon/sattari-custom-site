import { computeBeatGrid } from './stemBeatGrid.js';

// Beat tracking over a whole song can take a moment; keep it off the UI thread.
self.onmessage = ({ data: { id, samples, rate } }) => {
  try {
    self.postMessage({ id, grid: computeBeatGrid(samples, rate) });
  } catch (error) {
    self.postMessage({ id, error: error?.message || 'Beat tracking failed.' });
  }
};
